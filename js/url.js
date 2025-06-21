// URL Configuration for Scribd and SlideShare APIs
const URLS = {
    // Scribd download endpoint
    scribdDownload: 'https://compress-pdf.vietdreamhouse.com/?fileurl=https://scribd.downloader.tips/pdownload/',

    // New Scribd endpoints
    scribdCheck: 'https://compress-pdf.vietdreamhouse.com/check-status',
    scribdFinal: 'https://compress-pdf.vietdreamhouse.com/download/compresspdf',

    // CORS proxy for bypassing CORS restrictions
    corsProxy: 'https://render-proxy.deno.dev/proxy/',

    // Proxy endpoint for fetching Scribd documents
    proxyEndpoint: 'https://awayne-cors.glitch.me/',

    // SlideShare API endpoints
    slideshareApi: {
        // Endpoint to fetch images from SlideShare
        getImages: 'https://api.slidesdownloader.com/get-images',

        // Endpoint to generate SlideShare slides
        getSlide: 'https://api.slidesdownloader.com/get-slide',

        // Endpoint to download SlideShare slides
        download: 'https://api.slidesdownloader.com/dl-slide'
    }
};
