/**
 * File Upload Handler
 * Handles drag-and-drop, file selection, preview, and upload
 */

class FileUploadHandler {
    constructor(apiClient) {
        this.apiClient = apiClient;
        this.files = [];
        this.uploadedFiles = [];
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.maxFiles = 5;
        this.allowedTypes = {
            images: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
            documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        };
        
        this.init();
    }

    init() {
        const dropZone = document.getElementById('fileDropZone');
        const fileInput = document.getElementById('fileInput');
        const previewContainer = document.getElementById('filePreviewContainer');

        if (!dropZone || !fileInput || !previewContainer) {
            console.warn('File upload elements not found');
            return;
        }

        // Click to select files
        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Drag and drop events
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
            this.handleFiles(e.dataTransfer.files);
        });
    }

    handleFiles(fileList) {
        const newFiles = Array.from(fileList);

        // Check total file count
        if (this.files.length + newFiles.length > this.maxFiles) {
            this.showError(`يمكنك رفع ${this.maxFiles} ملفات كحد أقصى`);
            return;
        }

        // Validate and add files
        newFiles.forEach(file => {
            if (this.validateFile(file)) {
                this.files.push(file);
                this.addFilePreview(file);
            }
        });

        // Show preview container
        if (this.files.length > 0) {
            document.getElementById('filePreviewContainer').style.display = 'grid';
        }
    }

    validateFile(file) {
        // Check file size
        if (file.size > this.maxFileSize) {
            this.showError(`الملف "${file.name}" كبير جداً. الحد الأقصى 10 ميجابايت`);
            return false;
        }

        // Check file type
        const allAllowedTypes = [...this.allowedTypes.images, ...this.allowedTypes.documents];
        if (!allAllowedTypes.includes(file.type)) {
            this.showError(`نوع الملف "${file.name}" غير مدعوم`);
            return false;
        }

        return true;
    }

    addFilePreview(file) {
        const previewContainer = document.getElementById('filePreviewContainer');
        const fileId = Date.now() + Math.random();
        
        const previewItem = document.createElement('div');
        previewItem.className = 'file-preview-item';
        previewItem.dataset.fileId = fileId;

        // Create preview based on file type
        if (this.allowedTypes.images.includes(file.type)) {
            const img = document.createElement('img');
            img.className = 'file-preview-image';
            img.alt = file.name;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
            
            previewItem.appendChild(img);
        } else {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'file-preview-icon';
            iconDiv.innerHTML = '<i class="fas fa-file-pdf"></i>';
            previewItem.appendChild(iconDiv);
        }

        // File name
        const fileName = document.createElement('div');
        fileName.className = 'file-preview-name';
        fileName.textContent = file.name;
        fileName.title = file.name;
        previewItem.appendChild(fileName);

        // File size
        const fileSize = document.createElement('div');
        fileSize.className = 'file-preview-size';
        fileSize.textContent = this.formatFileSize(file.size);
        previewItem.appendChild(fileSize);

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'file-preview-remove';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.type = 'button';
        removeBtn.onclick = () => this.removeFile(fileId);
        previewItem.appendChild(removeBtn);

        previewContainer.appendChild(previewItem);
        
        // Store file with ID
        file.previewId = fileId;
    }

    removeFile(fileId) {
        // Remove from files array
        this.files = this.files.filter(f => f.previewId !== fileId);
        
        // Remove preview element
        const previewItem = document.querySelector(`[data-file-id="${fileId}"]`);
        if (previewItem) {
            previewItem.remove();
        }

        // Hide container if no files
        if (this.files.length === 0) {
            document.getElementById('filePreviewContainer').style.display = 'none';
        }

        // Reset file input
        document.getElementById('fileInput').value = '';
    }

    async uploadFiles() {
        if (this.files.length === 0) {
            return [];
        }

        const uploadedFiles = [];

        for (const file of this.files) {
            try {
                const previewItem = document.querySelector(`[data-file-id="${file.previewId}"]`);
                if (previewItem) {
                    previewItem.classList.add('file-preview-uploading');
                }

                const formData = new FormData();
                formData.append('file', file);

                // Determine endpoint based on file type
                const isImage = this.allowedTypes.images.includes(file.type);
                const endpoint = isImage ? '/upload/image' : '/upload/document';

                const response = await this.apiClient.request(endpoint, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        // Don't set Content-Type, let browser set it with boundary
                        'Authorization': `Bearer ${this.apiClient.getToken()}`
                    }
                });

                if (response.file) {
                    uploadedFiles.push(response.file);
                    
                    if (previewItem) {
                        previewItem.classList.remove('file-preview-uploading');
                        previewItem.classList.add('file-preview-success');
                    }
                }

            } catch (error) {
                console.error('Upload error:', error);
                
                const previewItem = document.querySelector(`[data-file-id="${file.previewId}"]`);
                if (previewItem) {
                    previewItem.classList.remove('file-preview-uploading');
                    previewItem.classList.add('file-preview-error');
                }
            }
        }

        this.uploadedFiles = uploadedFiles;
        return uploadedFiles;
    }

    async linkFilesToContent(contentId) {
        if (this.uploadedFiles.length === 0) {
            return;
        }

        const fileIds = this.uploadedFiles.map(f => f.id);
        
        try {
            await this.apiClient.request('/upload/link', {
                method: 'POST',
                body: JSON.stringify({
                    contentId: contentId,
                    fileIds: fileIds
                })
            });
        } catch (error) {
            console.error('Error linking files:', error);
        }
    }

    reset() {
        this.files = [];
        this.uploadedFiles = [];
        document.getElementById('filePreviewContainer').innerHTML = '';
        document.getElementById('filePreviewContainer').style.display = 'none';
        document.getElementById('fileInput').value = '';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 بايت';
        const k = 1024;
        const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    showError(message) {
        const messageDiv = document.getElementById('knowledgeMessage');
        if (messageDiv) {
            messageDiv.className = 'alert alert-danger';
            messageDiv.textContent = message;
            messageDiv.classList.remove('d-none');
            
            setTimeout(() => {
                messageDiv.classList.add('d-none');
            }, 5000);
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileUploadHandler;
}
