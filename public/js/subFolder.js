    function openSubfolderModal() { document.getElementById('subfolderModal').classList.remove('hidden'); }
    function closeSubfolderModal() { 
        document.getElementById('subfolderModal').classList.add('hidden'); 
        document.getElementById('createSubfolderForm').reset();
    }

    // Create Subfolder API Call
    document.getElementById('createSubfolderForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true; submitBtn.innerText = "Creating...";

        try {
            const response = await fetch('/organization/create-folders', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    folderName: document.getElementById('subfolderName').value, 
                    courseName: document.getElementById('subCourseName').value, 
                    parentId: document.getElementById('parentFolderId').value 
                })
            });

            const data = await response.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            alert("Network error.");
        } finally {
            submitBtn.disabled = false; submitBtn.innerText = "Create";
        }
    });

    async function deleteSubfolder(id, name) {
        if(!confirm(`Are you sure you want to delete subfolder '${name}'?`)) return;

        try {
            const response = await fetch(`/organization/delete-folders/${id}`, { method: 'DELETE' });
            const data = await response.json();

            if (response.ok && data.success) {
                window.location.reload();
            } else {
                alert("Error: " + (data.error || "Failed to delete subfolder."));
            }
        } catch (error) {
            console.error("Delete Error:", error);
            alert("Server error occurred while deleting.");
        }
    }

    // ==========================================
// ASSIGN VIDEO MODAL LOGIC
// ==========================================

async function openAssignVideoModal() {
    document.getElementById('assignVideoModal').classList.remove('hidden');
    
    const selectBox = document.getElementById('vidS3Key');
    selectBox.innerHTML = '<option value="">Fetching S3 Videos...</option>';

    try {
        // API call to fetch AWS S3 videos
        const response = await fetch('/organization/api/s3-video-list');
        const data = await response.json();

        if (data.success) {
            if (data.videos.length > 0) {
                selectBox.innerHTML = '<option value="">-- Select a Video --</option>';
                data.videos.forEach(v => {
                    selectBox.innerHTML += `<option value="${v.key}">${v.key} (${v.size})</option>`;
                });
            } else {
                selectBox.innerHTML = '<option value="">No videos found in S3 bucket.</option>';
            }
        } else {
            selectBox.innerHTML = '<option value="">Error fetching videos.</option>';
        }
    } catch (error) {
        selectBox.innerHTML = '<option value="">Failed to connect to server.</option>';
    }
}

function closeAssignVideoModal() {
    document.getElementById('assignVideoModal').classList.add('hidden');
    document.getElementById('assignVideoForm').reset();
}

// Assign Video Form Submit Logic
const assignVideoForm = document.getElementById('assignVideoForm');
if(assignVideoForm) {
    assignVideoForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = true; 
        submitBtn.innerText = "Assigning...";

        try {
            const bodyData = {
                folderId: document.getElementById('parentFolderId').value, // Hidden input se folder ID liya
                videoName: document.getElementById('vidName').value,
                videoDesc: document.getElementById('vidDesc').value,
                videoIcon: document.getElementById('vidIcon').value,
                s3Key: document.getElementById('vidS3Key').value
            };

            const response = await fetch('/organization/api/assign-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData)
            });

            const data = await response.json();

            if (data.success) {
                window.location.reload(); // Page reload karke table update karein
            } else {
                alert("Error: " + data.error);
            }
        } catch (error) {
            alert("Network error while assigning video.");
        } finally {
            submitBtn.disabled = false; 
            submitBtn.innerText = "Assign Video";
        }
    });
}