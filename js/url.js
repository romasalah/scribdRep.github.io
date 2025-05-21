// URL Configuration for Scribd and SlideShare APIs
const URLS = {
    // Scribd download endpoint
    scribdDownload: 'https://ilide.info/docgeneratev2?fileurl=https://scribd.vdownloaders.com/pdownload/',

    // CORS proxy for bypassing CORS restrictions
    corsProxy: 'https://awayne-cors.glitch.me/',

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
