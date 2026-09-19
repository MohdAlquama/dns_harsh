// public/js/courseFolder.js

const folderModal = document.getElementById('createFolderModal');
const createFolderForm = document.getElementById('createFolderForm');

// ---------- Modal ----------
function openFolderModal() {
  folderModal.classList.remove('hidden');
  folderModal.classList.add('flex');
}

function closeFolderModal() {
  folderModal.classList.add('hidden');
  folderModal.classList.remove('flex');
  createFolderForm.reset();
}

createFolderForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  const folderName = this.folderName.value;
  const courseName = this.courseName.value;
  const submitBtn = this.querySelector('button[type="submit"]');

  const originalText = submitBtn.innerText;
  submitBtn.innerText = "Creating...";
  submitBtn.disabled = true;

  try {
    const response = await fetch('/organization/create-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderName, courseName })
    });
    const data = await response.json();

    if (data.success) {
      alert("Folder created successfully!");
      closeFolderModal();
      window.location.reload();
    } else {
      alert("Error: " + data.error);
    }
  } catch (error) {
    console.error(error);
    alert("Server error occurred while creating folder.");
  } finally {
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
  }
});

async function deleteFolder(id, folderName) {
  if (!confirm(`Are you sure you want to delete '${folderName}'?`)) return;

  try {
    const response = await fetch(`/organization/delete-folders/${id}`, { method: 'DELETE' });
    const data = await response.json();

    if (data.success) {
      window.location.reload();
    } else {
      alert("Error: " + data.error);
    }
  } catch (error) {
    alert("Server error occurred.");
  }
}

// ---------- Icons ----------
const folderIconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-violet-500" fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
  </svg>`;

const fileIconSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-sky-500" fill="currentColor" viewBox="0 0 20 20">
    <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm7 0v3a1 1 0 001 1h3l-4-4z" clip-rule="evenodd" />
  </svg>`;

// ---------- Tree rendering ----------
function toggleNode(btn) {
  const row = btn.closest('.node-row');
  const wrapper = row.parentElement;
  const children = wrapper.querySelector(':scope > .children');
  const icon = row.querySelector('.toggle-icon');
  if (!children) return;
  children.classList.toggle('collapsed');
  icon.classList.toggle('open');
}

function renderFolderNode(folder) {
  const hasChildren = (folder.children && folder.children.length) || (folder.files && folder.files.length);

  const filesHtml = (folder.files || []).map(file => `
    <li>
      <div class="node-row">
        <span class="w-4"></span>
        ${fileIconSvg}
        <span class="text-gray-700">${escapeHtml(file.video_name)}</span>
      </div>
    </li>
  `).join('');

  const childFoldersHtml = (folder.children || []).map(renderFolderNode).join('');

  return `
    <li>
      <div class="node-row" onclick="handleFolderClick(event, ${folder.id})">
        <button type="button" class="toggle-icon ${hasChildren ? '' : 'invisible'}" onclick="event.stopPropagation(); toggleNode(this)">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        ${folderIconSvg}
        <span class="font-medium text-gray-900">${escapeHtml(folder.folder_name)}</span>
        <span class="text-gray-400 text-xs">— ${escapeHtml(folder.course_name)}</span>
        <span class="text-gray-300 text-xs ml-2">${formatDate(folder.created_at)}</span>
        <span class="ml-auto flex items-center gap-2 shrink-0" onclick="event.stopPropagation()">
          <a href="/organization/folders-open/${folder.id}" class="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100 transition">
            Open
          </a>
          <button type="button" onclick="deleteFolder(${folder.id}, '${escapeHtml(folder.folder_name).replace(/'/g, "\\'")}')" class="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition">
            Delete
          </button>
        </span>
      </div>
      ${hasChildren ? `<ul class="children">${childFoldersHtml}${filesHtml}</ul>` : ''}
    </li>
  `;
}

function handleFolderClick(evt, id) {
  // Click on the row (not the toggle arrow or action buttons) opens the folder
  window.location.href = `/organization/folders-open/${id}`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderTree() {
  const root = document.getElementById('treeRoot');
  const emptyState = document.getElementById('emptyState');

  if (!folderTree || folderTree.length === 0) {
    root.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  const html = folderTree.map(renderFolderNode).join('');
  root.innerHTML = `<ul>${html}</ul>`;
}

function expandAll() {
  document.querySelectorAll('.children').forEach(el => el.classList.remove('collapsed'));
  document.querySelectorAll('.toggle-icon').forEach(el => el.classList.add('open'));
}

function collapseAll() {
  document.querySelectorAll('.children').forEach(el => el.classList.add('collapsed'));
  document.querySelectorAll('.toggle-icon').forEach(el => el.classList.remove('open'));
}

document.addEventListener('DOMContentLoaded', renderTree);