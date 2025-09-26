// Inhalt von: .eleventy.js
module.exports = function(eleventyConfig) {
    
    // Stellt sicher, dass nur Nunjucks und Markdown geparst werden
    eleventyConfig.setTemplateFormats([
        "njk", 
        "md", 
    ]);

    return {
        // Explizit Input und Output definieren, um Standard-Konflikte zu vermeiden
        dir: {
            input: "benches",
            output: "."
        }
    };
};
