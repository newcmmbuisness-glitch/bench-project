// Inhalt von: Main/.eleventy.js

module.exports = function(eleventyConfig) {
    // Weist Eleventy an, alle .html Dateien zu kopieren (Passthrough),
    // anstatt sie als Liquid/Nunjucks-Templates zu parsen.
    // Nur Dateien, die Sie explizit umbenennen (z.B. meet.njk), 
    // werden als Templates behandelt.
    eleventyConfig.addPassthroughCopy("**/*.html"); 
    
    return {
        // Hier können Sie bei Bedarf weitere Einstellungen vornehmen
    };
};
