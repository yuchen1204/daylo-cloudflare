import { Note, Notebook } from '../types';
import { syncService } from './firebase';
import { saveNote, saveNotebook, deleteNote, deleteNotebook, initializeData } from './storage';
import { User } from 'firebase/auth';

// Queue for outgoing changes to avoid blocking UI
let syncQueue: Promise<any> = Promise.resolve();

/**
 * 核心同步逻辑，在用户登录时触发。
 *
 * 该函数旨在解决本地数据与云端数据可能存在的冲突，尤其是在离线操作后。
 * 它遵循一个明确的“云端优先”原则来合并笔记本，并基于最后更新时间来同步笔记。
 *
 * @param user 已认证的Firebase用户对象。
 * @returns 返回一个包含最新、最权威的笔记和笔记本列表的对象，用于更新应用状态。
 *
 * 合并策略：
 * 1.  **数据聚合**：首先，将本地和云端的所有笔记本和笔记分别聚合到一个列表中，以便进行统一处理。
 *
 * 2.  **笔记本权威性确立（云端优先）**：
 *    -   通过笔记本名称 (`name`) 作为唯一标识来确定权威笔记本。
 *    -   创建一个权威笔记本的映射表（`canonicalNotebooks`），键为笔记本名称。
 *    -   遍历所有笔记本（先云端后本地），当遇到同名笔记本时：
 *        - 如果权威列表中尚无此名称的笔记本，则添加当前遍历到的笔记本。
 *        - 由于先遍历云端，这确保了如果云端存在该名称的笔记本，它将首先被确立为权威版本。
 *
 * 3.  **ID映射与冗余标记**：
 *    -   建立一个从任何旧ID（本地或云端）到其对应权威笔记本ID的映射（`notebookIdMap`）。
 *    -   同时，记录下所有非权威（即被合并掉的）笔记本的ID，以便后续清理（`redundantNotebookIds`）。
 *
 * 4.  **笔记合并与更新（基于时间戳）**：
 *    -   将所有笔记聚合，并以笔记ID (`id`) 进行分组。
 *    -   对于每个分组（代表同一个笔记在本地和云端的不同版本）：
 *        -   如果只有一个版本，则直接采纳。
 *        -   如果存在本地和云端两个版本，则比较 `updatedAt` 时间戳，保留最新版本。
 *    -   在确定最终笔记版本后，使用 `notebookIdMap` 来修正其 `notebookId`，确保它指向权威笔记本。
 *
 * 5.  **数据持久化与清理**：
 *    -   **本地持久化**：将所有权威笔记本和最终确定的笔记版本保存到本地IndexedDB。
 *    -   **云端推送**：将需要推送到云端的新数据（本地创建或更新的）进行批量推送。
 *    -   **清理操作**：
 *        -   从本地IndexedDB中删除所有被标记为冗余的笔记本。
 *        -   从云端删除所有对应的冗余笔记本和笔记。
 *
 * 6.  **返回结果**：最后，从本地存储重新加载所有数据，确保返回给UI的是最干净、最一致的状态。
 */
export const handleUserLogin = async (user: User) => {
  // 1. 拉取云端和本地数据
  const [cloudData, localData] = await Promise.all([
    syncService.pullAll(user),
    initializeData(),
  ]);

  const allNotebooks = [...cloudData.notebooks, ...localData.notebooks];
  const allNotes = [...cloudData.notes, ...localData.notes];

  // 2. 确立权威笔记本（云端优先）
  const canonicalNotebooks = new Map<string, Notebook>();
  allNotebooks.forEach(nb => {
    if (!canonicalNotebooks.has(nb.name)) {
      canonicalNotebooks.set(nb.name, nb);
    }
  });

  // 3. 建立ID映射并标记冗余笔记本
  const notebookIdMap = new Map<string, string>();
  const redundantNotebookIds = new Set<string>();
  allNotebooks.forEach(nb => {
    const canonical = canonicalNotebooks.get(nb.name)!;
    if (nb.id !== canonical.id) {
      redundantNotebookIds.add(nb.id);
    }
    notebookIdMap.set(nb.id, canonical.id);
  });

  // 4. 合并笔记（基于最新时间戳）
  const notesById = new Map<string, Note[]>();
  allNotes.forEach(note => {
    if (!notesById.has(note.id)) notesById.set(note.id, []);
    notesById.get(note.id)!.push(note);
  });

  const finalNotes: Note[] = [];
  for (const [_, noteVersions] of notesById.entries()) {
    // 排序，确保最新的在最前面
    noteVersions.sort((a, b) => b.updatedAt - a.updatedAt);
    const newestNote = { ...noteVersions[0] };

    // 修正 notebookId
    const canonicalNotebookId = notebookIdMap.get(newestNote.notebookId);
    if (canonicalNotebookId) {
      newestNote.notebookId = canonicalNotebookId;
      finalNotes.push(newestNote);
    }
    // 如果找不到笔记本，说明该笔记所属的笔记本已被删除，此笔记也应被丢弃
  }

  // 5. 数据持久化和清理
  const finalNotebooks = Array.from(canonicalNotebooks.values());

  // 需要推送到云端的数据
  const notebooksToPush = finalNotebooks.filter(
    nb => !cloudData.notebooks.some(cnb => cnb.id === nb.id)
  );
  const notesToPush = finalNotes.filter(
    note => !cloudData.notes.some(cn => cn.id === note.id && cn.updatedAt >= note.updatedAt)
  );

  // 批量保存到本地
  for (const nb of finalNotebooks) await saveNotebook(nb);
  for (const note of finalNotes) await saveNote(note);

  // 批量推送到云端
  for (const nb of notebooksToPush) syncService.pushNotebook(user, nb);
  for (const note of notesToPush) syncService.pushNote(user, note);

  // 清理冗余数据
  for (const id of redundantNotebookIds) {
    if (localData.notebooks.some(nb => nb.id === id)) await deleteNotebook(id);
    if (cloudData.notebooks.some(nb => nb.id === id)) syncService.deleteNotebook(user, id);
  }

  // 6. 返回最新状态
  return initializeData();
};

// Hook into storage operations
// We need to wrap the existing storage functions or intercept them in App.tsx
// Since we are using App.tsx as the controller, we can call sync logic there.
