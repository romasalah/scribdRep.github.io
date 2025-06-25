$(document).ready(function () {
    // ==========================================
    // Constants and Global Variables
    // ==========================================
    const validDomains = {
        scribd: /^https:\/\/(?:[a-z]{2,3}\.)?scribd\.com\/(?:document|doc|presentation)\/(\d+)\/([^\/]+)$/,
        slideshare: /^(?:https?:\/\/)?(?:www\.)?slideshare\.net\/([^\/]+)\/([^\/]+)/
    };

    let state = {
        downloadUrl: '',
        currentService: '',
        slideshareDocInfo: null,
        scribdJobId: '',
        scribdJobType: '',
        scribdPageCount: 0,
        scribdRenderTime: 0,
        currentPage: 0
    };

    // ==========================================
    // UI Elements
    // ==========================================
    const elements = {
        errorMessage: $('.error-message'),
        downloadBtn: $('#downloadBtn'),
        switchContainer: $('.switch-container'),
        switchContainer2: $('.switch-container-2'),
        scribdLink: $('#scribdLink'),
        finalDownloadBtn: $('#finalDownloadBtn'),
        sliderToggle: $('#sliderToggle'),
        sliderToggleFormat: $('#sliderToggleFormat'),
        noteText: $('.note-text')
    };

    // Initialize UI
    elements.switchContainer.hide();
    elements.switchContainer2.hide();

    // ==========================================
    // Utility Functions
    // ==========================================
    function sanitizeFileName(fileName) {
        try {
            // First properly decode the URI component to handle UTF-8 characters
            const decodedName = decodeURIComponent(fileName);
            return decodedName
                .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid filename chars
                .replace(/\s+/g, '_')           // Replace spaces with underscores
                .replace(/_{2,}/g, '_')         // Remove multiple consecutive underscores
                .replace(/^_+|_+$/g, '')        // Trim leading/trailing underscores
                .trim();
        } catch (e) {
            // If decoding fails, try a different approach for non-Latin characters
            return fileName
                .replace(/[<>:"/\\|?*]/g, '_')
                .replace(/\s+/g, '_')
                .replace(/_{2,}/g, '_')
                .replace(/^_+|_+$/g, '')
                .trim();
        }
    }

    function parseSlideShareUrl(url) {
        const match = url.match(validDomains.slideshare);
        if (!match) return null;

        const [, username, docName] = match;
        const cleanDocName = docName.split('/')[0];

        return {
            username,
            documentName: cleanDocName,
            cleanName: cleanDocName
                .replace(/-/g, ' ')
                .replace(/[^a-zA-Z0-9\u0400-\u04FF\s]/g, '') // Allow Cyrillic chars range
                .trim()
        };
    }

    function calculateRenderTime(pageCount) {
        const perPageDelay = 600; // 600ms per page
        return pageCount * perPageDelay;
    }

    function formatRenderTime(milliseconds) {
        const seconds = Math.ceil(milliseconds / 1000);
        if (seconds < 60) {
            return `${seconds} seconds`;
        } else {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return remainingSeconds > 0 ? `${minutes} minutes ${remainingSeconds} seconds` : `${minutes} minutes`;
        }
    }

    function updateNoteText(renderTime) {
        const formattedTime = formatRenderTime(renderTime);
        elements.noteText.html(`
            <i class="bi bi-info-circle me-1"></i>
            <strong>Note:</strong> Download link will open in <i class="bi bi-box-arrow-up-right mx-1"></i>New Window. 
            Please allow Popup to download.
        `);
    }

    function updateNoteTextRealTime(currentPage, totalPages, totalRenderTime) {
        const formattedTotalTime = formatRenderTime(totalRenderTime);
        elements.noteText.html(`
            <i class="bi bi-info-circle me-1"></i>
            <strong>Pages:</strong> ${currentPage}/${totalPages} | <strong>Total render time:</strong> ${formattedTotalTime}<br>
            Download link will open in <i class="bi bi-box-arrow-up-right mx-1"></i>New Window. 
            Please allow Popup to download.
        `);
    }

    function showCompletedNoteText(totalPages, totalRenderTime) {
        const formattedTotalTime = formatRenderTime(totalRenderTime);
        elements.noteText.html(`
            <i class="bi bi-check-circle me-1"></i>
            <strong>Pages:</strong> ${totalPages}/${totalPages} | <strong>Total render time:</strong> ${formattedTotalTime}<br>
            Download link will open in <i class="bi bi-box-arrow-up-right mx-1"></i>New Window. 
            Please allow Popup to download.
        `);
        
        // Reset to default note text after 5 seconds
        setTimeout(() => {
            elements.noteText.html(`
                <i class="bi bi-info-circle me-1"></i>
                <strong>Note:</strong> Download link will open in <i class="bi bi-box-arrow-up-right mx-1"></i>New Window. 
                Please allow Popup to download.
            `);
        }, 5000);
    }

    // ==========================================
    // UI State Management
    // ==========================================
    function setLoadingState() {
        elements.downloadBtn
            .addClass('loading-state')
            .html('<i class="bi bi-arrow-repeat rotating-icon me-2"></i>Processing...');
    }

    function resetLoadingState() {
        elements.downloadBtn
            .removeClass('loading-state')
            .html('<i class="bi bi-download me-2"></i>Download');
    }

    function setFinalDownloadLoadingState(button) {
        button
            .prop('disabled', true)
            .html('<i class="bi bi-arrow-repeat rotating-icon me-2"></i>Downloading...');
    }

    function resetFinalDownloadLoadingState(button) {
        button
            .prop('disabled', false)
            .html('<i class="bi bi-download me-2"></i>Download');
    }

    function showError(message) {
        elements.errorMessage.show().html(`<i class="bi bi-exclamation-octagon me-2"></i>${message}`);
    }

    function hideError() {
        elements.errorMessage.hide();
    }

    function showConfirmationModal(fileName, fileType) {
        $('#fileName').text(fileName);
        $('#fileType').text(fileType);
        $('#downloadButtonText').text(`Download as ${fileType}`);
        $('#confirmationModal').modal('show');
    }

    // ==========================================
    // Core Download Logic
    // ==========================================
    async function downloadFile(url, fileName) {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to download file');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    }

    async function processSlideShare(url) {
        const hdEnabled = elements.sliderToggle.prop('checked');
        const encodedUrl = encodeURIComponent(url);
        const getUrl = `${URLS.slideshareApi.getImages}?url=${encodedUrl}&hd=${hdEnabled}`;
        
        const getResponse = await $.get(getUrl);
        if (!getResponse?.images?.length) {
            throw new Error('No images found');
        }

        const postPayload = {
            hd: hdEnabled,
            images: getResponse.images,
            type: elements.sliderToggleFormat.prop('checked') ? "pptx" : "pdf"
        };

        const postResponse = await $.ajax({
            url: URLS.slideshareApi.getSlide,
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(postPayload)
        });

        if (!postResponse?.url) {
            throw new Error('Invalid server response');
        }

        return `${URLS.slideshareApi.download}?${new URLSearchParams(postResponse).toString()}`;
    }

   async function getScribdInfo(scribdUrl) {
    try {
        const countUrl = `${URLS.scribdCount}${encodeURIComponent(scribdUrl)}`;
        console.log('Calling:', countUrl);

        const countResponse = await $.ajax({
            url: countUrl,
            method: 'GET',
            dataType: 'json'
        });

        console.log('Count response:', countResponse);

        state.scribdPageCount = countResponse?.pageCount || 0;
        state.scribdRenderTime = calculateRenderTime(state.scribdPageCount);

        const simulationPromise = simulatePageProcessing();

        const predownloadUrl = `${URLS.scribdPredownload}${encodeURIComponent(scribdUrl)}`;
        console.log('Calling:', predownloadUrl);

        const predownloadResponse = await $.ajax({
            url: predownloadUrl,
            method: 'GET',
            dataType: 'json'
        });

        console.log('Predownload response:', predownloadResponse);

        state.scribdJobId = predownloadResponse?.id || predownloadResponse?.job_id;

        if (!state.scribdJobId) {
            throw new Error('Failed to get download ID from server');
        }

        await simulationPromise;

        return {
            pageCount: state.scribdPageCount,
            jobId: state.scribdJobId,
            renderTime: state.scribdRenderTime
        };

    } catch (error) {
        console.error('Error getting Scribd info:', error);
        throw new Error('Failed to get document information');
    }
}

    async function simulatePageProcessing() {
        return new Promise((resolve) => {
            state.currentPage = 0;
            
            // Wait 5 seconds before starting (hidden from user)
            setTimeout(() => {
                const interval = setInterval(() => {
                    state.currentPage++;
                    
                    // Update the UI with current progress
                    updateNoteTextRealTime(state.currentPage, state.scribdPageCount, state.scribdRenderTime);
                    
                    // Check if all pages are processed
                    if (state.currentPage >= state.scribdPageCount) {
                        clearInterval(interval);
                        // Show completion message
                        showCompletedNoteText(state.scribdPageCount, state.scribdRenderTime);
                        resolve();
                    }
                }, 600); // 600ms per page
            }, 5000); // 5 second initial delay (hidden)
        });
    }

    async function handleScribdDownload() {
        try {
            const scribdUrl = elements.scribdLink.val().trim();
            
            // This will get pageCount, start simulation immediately, then get jobId
            await getScribdInfo(scribdUrl);
            
            // Simulation is already complete, now download using the job ID
            const downloadUrl = `${URLS.scribdFinal}${state.scribdJobId}`;
            
            // Get the document name for the filename
            const match = scribdUrl.match(validDomains.scribd);
            
            if (!match || match.length < 3) {
                throw new Error('Invalid Scribd URL format');
            }
            
            const [, docId, docName] = match;
            
            // Properly handle the docName for international characters
            let fileName;
            try {
                const decodedDocName = decodeURIComponent(docName);
                fileName = `${sanitizeFileName(decodedDocName)}.pdf`;
            } catch (e) {
                fileName = `${sanitizeFileName(docName)}.pdf`;
            }
            
            // Download the file
            await downloadFile(downloadUrl, fileName);
            
        } catch (error) {
            console.error('Detailed error:', error);
            throw error;
        }
    }

    async function handleSlideShareDownload() {
        if (!state.slideshareDocInfo) throw new Error('No SlideShare document info');
        
        const fileExt = elements.sliderToggleFormat.prop('checked') ? 'pptx' : 'pdf';
        const fileName = `${sanitizeFileName(state.slideshareDocInfo.documentName)}.${fileExt}`;
        await downloadFile(state.downloadUrl, fileName);
    }

    // ==========================================
    // Event Handlers
    // ==========================================
    elements.scribdLink.on('input', function () {
        const val = $(this).val().trim();
        hideError();
        const isSlideShare = parseSlideShareUrl(val) !== null;
        elements.switchContainer.toggle(isSlideShare);
        elements.switchContainer2.toggle(isSlideShare);
    });

    $('#downloadForm').on('submit', async function (e) {
        e.preventDefault();
        const input = elements.scribdLink.val().trim();

        if (!input) {
            this.reportValidity();
            hideError();
            return;
        }

        const isScribd = validDomains.scribd.test(input);
        state.slideshareDocInfo = parseSlideShareUrl(input);
        const isSlideshare = state.slideshareDocInfo !== null;

        if (!isScribd && !isSlideshare) {
            showError('Please insert a valid Scribd or SlideShare link!');
            return;
        }

        setLoadingState();
        hideError();
        state.currentService = isScribd ? 'scribd' : 'slideshare';

        try {
            if (isScribd) {
                const match = input.match(validDomains.scribd);
                if (!match || match.length < 3) {
                    throw new Error('Invalid Scribd URL format');
                }
                
                const [, docId, docName] = match;
                
                // Show a properly decoded name in the confirmation modal
                let displayName;
                try {
                    displayName = decodeURIComponent(docName).replace(/-/g, ' ');
                } catch (e) {
                    displayName = docName.replace(/-/g, ' ');
                }
                
                // For Scribd, just show the modal - no API calls yet
                showConfirmationModal(displayName, 'PDF');
            } else {
                // For SlideShare, we still need to process it here
                state.downloadUrl = await processSlideShare(input);
                showConfirmationModal(
                    state.slideshareDocInfo.documentName.replace(/-/g, ' '),
                    elements.sliderToggleFormat.prop('checked') ? 'PPTX' : 'PDF'
                );
            }
        } catch (error) {
            console.error('Processing error:', error);
            showError('Processing failed. Please try again!');
        } finally {
            resetLoadingState();
        }
    });

    elements.finalDownloadBtn.on('click', async function (e) {
        e.preventDefault();

        const button = $(this);
        setFinalDownloadLoadingState(button);

        try {
            if (state.currentService === 'scribd') {
                await handleScribdDownload();
            } else {
                await handleSlideShareDownload();
            }
        } catch (error) {
            console.error('Download error:', error);
            showError(error.message.includes('Failed to') ? error.message : 'Download failed. Please try again.');
        } finally {
            resetFinalDownloadLoadingState(button);
            $('#confirmationModal').modal('hide');
        }
    });
});
