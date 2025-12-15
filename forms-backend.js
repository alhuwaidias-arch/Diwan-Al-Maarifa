/**
 * Forms Handler for Diwan Al-Maarifa Platform
 * Updated to use backend API instead of Google Scripts
 */

// Knowledge Sharing Form Handler (Content Submission)
document.getElementById('knowledgeForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Check if user is authenticated
    if (!apiClient.isAuthenticated()) {
        alert('يجب تسجيل الدخول أولاً لمشاركة المعرفة');
        const modal = bootstrap.Modal.getInstance(document.getElementById('knowledgeModal'));
        if (modal) modal.hide();
        
        // Show login modal
        const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
        loginModal.show();
        return;
    }
    
    const submitBtn = document.getElementById('knowledgeSubmitBtn');
    const messageDiv = document.getElementById('knowledgeMessage');
    const field = document.getElementById('knowledgeField').value;
    const contributionType = document.getElementById('knowledgeType').value;
    const titleAr = document.getElementById('knowledgeTitleAr').value.trim();
    const titleEn = ''; // English title removed - Arabic only platform
    const contentAr = document.getElementById('knowledgeContentAr').value.trim();
    const contentEn = ''; // English content removed - Arabic only platform
    const notes = document.getElementById('knowledgeNotes')?.value.trim() || '';
    
    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>جاري الإرسال...';
    messageDiv.classList.add('d-none');
    
    try {
        // First, upload files if any
        let uploadedFiles = [];
        if (window.fileUploadHandler && window.fileUploadHandler.files.length > 0) {
            uploadedFiles = await window.fileUploadHandler.uploadFiles();
        }
        
        const contentData = {
            category_id: field,
            title_ar: titleAr,
            title_en: titleEn,
            content_ar: contentAr,
            content_en: contentEn,
            notes: notes,
            type: contributionType // 'term' or 'article'
        };
        
        const response = await apiClient.submitContent(contentData);
        
        // Link uploaded files to content if any
        if (uploadedFiles.length > 0 && response.content && response.content.id) {
            await window.fileUploadHandler.linkFilesToContent(response.content.id);
        }
        
        showMessage(messageDiv, 'success', 'تم إرسال مشاركتك بنجاح! سنقوم بمراجعتها قريباً.');
        document.getElementById('knowledgeForm').reset();
        
        // Reset file upload handler
        if (window.fileUploadHandler) {
            window.fileUploadHandler.reset();
        }
        
        // Close modal after 2 seconds
        setTimeout(() => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('knowledgeModal'));
            if (modal) modal.hide();
            messageDiv.classList.add('d-none');
        }, 2000);
        
    } catch (error) {
        console.error('Error:', error);
        showMessage(messageDiv, 'danger', error.message || 'حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane me-2"></i>إرسال المشاركة';
    }
});

// Load categories dynamically
async function loadCategories() {
    try {
        const response = await apiClient.getCategories();
        const categories = response.categories;
        
        // Update category dropdown in knowledge form
        const categorySelect = document.getElementById('knowledgeField');
        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">اختر المجال</option>';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.category_id;
                option.textContent = category.name_ar;
                categorySelect.appendChild(option);
            });
        }
        
        // Update categories page if exists
        const categoriesContainer = document.getElementById('categoriesContainer');
        if (categoriesContainer) {
            renderCategories(categories);
        }
        
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Render categories on categories page
function renderCategories(categories) {
    const container = document.getElementById('categoriesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    categories.forEach(category => {
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4 mb-4';
        card.innerHTML = `
            <div class="card h-100 category-card">
                <div class="card-body">
                    <h3 class="card-title">${category.name_ar}</h3>
                    <p class="text-muted">${category.name_en}</p>
                    <p class="card-text">${category.description_ar || ''}</p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <span class="badge bg-primary">${category.content_count} محتوى</span>
                        <a href="category-${category.slug}.html" class="btn btn-sm btn-outline-primary">
                            عرض المحتوى <i class="fas fa-arrow-left ms-2"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Load content for specific category
async function loadCategoryContent(categorySlug) {
    try {
        const response = await apiClient.getCategoryBySlug(categorySlug);
        const category = response.category;
        const content = response.content || [];
        
        // Update page title and description
        const pageTitle = document.getElementById('categoryTitle');
        const pageDescription = document.getElementById('categoryDescription');
        
        if (pageTitle) pageTitle.textContent = category.name_ar;
        if (pageDescription) pageDescription.textContent = category.description_ar;
        
        // Render content list
        const contentContainer = document.getElementById('categoryContent');
        if (contentContainer) {
            renderContentList(content);
        }
        
    } catch (error) {
        console.error('Error loading category content:', error);
    }
}

// Render content list
function renderContentList(contentItems) {
    const container = document.getElementById('categoryContent');
    if (!container) return;
    
    if (contentItems.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                لا يوجد محتوى منشور في هذا المجال حالياً
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    contentItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'col-md-6 col-lg-4 mb-4';
        card.innerHTML = `
            <div class="card h-100 content-card">
                <div class="card-body">
                    <span class="badge bg-secondary mb-2">${item.type === 'term' ? 'مصطلح' : 'مقال'}</span>
                    <h4 class="card-title">${item.title_ar}</h4>
                    ${item.title_en ? `<p class="text-muted">${item.title_en}</p>` : ''}
                    <p class="card-text">${item.content_ar.substring(0, 150)}...</p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <small class="text-muted">
                            <i class="fas fa-eye me-1"></i> ${item.view_count || 0}
                        </small>
                        <a href="${item.type}-${item.slug}.html" class="btn btn-sm btn-primary">
                            قراءة المزيد <i class="fas fa-arrow-left ms-2"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Load user's submissions
async function loadMySubmissions() {
    if (!apiClient.isAuthenticated()) {
        window.location.href = '/index.html';
        return;
    }
    
    try {
        const response = await apiClient.getMyContent();
        const submissions = response.submissions || [];
        
        const container = document.getElementById('mySubmissionsContainer');
        if (!container) return;
        
        if (submissions.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    لم تقم بإرسال أي مشاركات بعد
                </div>
            `;
            return;
        }
        
        renderSubmissionsList(submissions, container);
        
    } catch (error) {
        console.error('Error loading submissions:', error);
    }
}

// Render submissions list
function renderSubmissionsList(submissions, container) {
    container.innerHTML = '';
    
    submissions.forEach(submission => {
        const statusBadge = getStatusBadge(submission.submission_status);
        const card = document.createElement('div');
        card.className = 'col-md-6 mb-4';
        card.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title">${submission.title_ar}</h5>
                        ${statusBadge}
                    </div>
                    <p class="text-muted small">${submission.title_en || ''}</p>
                    <p class="card-text">${submission.content_ar.substring(0, 100)}...</p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <small class="text-muted">
                            <i class="fas fa-calendar me-1"></i>
                            ${new Date(submission.created_at).toLocaleDateString('ar-SA')}
                        </small>
                        <div>
                            <button class="btn btn-sm btn-outline-primary" onclick="viewSubmission('${submission.submission_id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${submission.submission_status === 'draft' ? `
                                <button class="btn btn-sm btn-outline-danger" onclick="deleteSubmission('${submission.submission_id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Get status badge HTML
function getStatusBadge(status) {
    const statusMap = {
        'draft': { text: 'مسودة', class: 'secondary' },
        'submitted': { text: 'قيد المراجعة', class: 'info' },
        'under_content_review': { text: 'مراجعة المحتوى', class: 'warning' },
        'under_technical_review': { text: 'مراجعة تقنية', class: 'warning' },
        'approved': { text: 'معتمد', class: 'success' },
        'rejected': { text: 'مرفوض', class: 'danger' },
        'published': { text: 'منشور', class: 'success' }
    };
    
    const statusInfo = statusMap[status] || { text: status, class: 'secondary' };
    return `<span class="badge bg-${statusInfo.class}">${statusInfo.text}</span>`;
}

// Delete submission
async function deleteSubmission(submissionId) {
    if (!confirm('هل أنت متأكد من حذف هذه المشاركة؟')) {
        return;
    }
    
    try {
        await apiClient.deleteContent(submissionId);
        alert('تم حذف المشاركة بنجاح');
        loadMySubmissions();
    } catch (error) {
        console.error('Error deleting submission:', error);
        alert('حدث خطأ أثناء حذف المشاركة');
    }
}

// Helper function to show messages
function showMessage(element, type, message) {
    element.className = `alert alert-${type}`;
    element.textContent = message;
    element.classList.remove('d-none');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize file upload handler
    if (typeof FileUploadHandler !== 'undefined') {
        window.fileUploadHandler = new FileUploadHandler(apiClient);
    }
    
    // Load categories for dropdown and categories page
    loadCategories();
    
    // Load category content if on category page
    const categorySlug = getCategorySlugFromURL();
    if (categorySlug) {
        loadCategoryContent(categorySlug);
    }
    
    // Load user submissions if on my submissions page
    if (document.getElementById('mySubmissionsContainer')) {
        loadMySubmissions();
    }
});

// Get category slug from URL
function getCategorySlugFromURL() {
    const path = window.location.pathname;
    const match = path.match(/category-([^.]+)\.html/);
    return match ? match[1] : null;
}

// Reset message when modals are closed
document.getElementById('knowledgeModal')?.addEventListener('hidden.bs.modal', function() {
    document.getElementById('knowledgeMessage').classList.add('d-none');
    document.getElementById('knowledgeForm').reset();
    
    // Reset file upload handler
    if (window.fileUploadHandler) {
        window.fileUploadHandler.reset();
    }
});
