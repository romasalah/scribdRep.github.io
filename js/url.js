// URL Configuration for Scribd and SlideShare APIs
const URLS = {
    // Scribd download endpoint
    scribdCount: 'https://api2.slidesdownloader.com:8443/count?url=',

    // New Scribd endpoints
    scribdPredownload: 'https://api2.slidesdownloader.com:8443/?url=',
    scribdFinal: 'https://api2.slidesdownloader.com:8443/dl?id=',

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
