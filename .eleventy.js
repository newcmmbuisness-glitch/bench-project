// Inhalt von: .eleventy.js

module.exports = function(eleventyConfig) {
    
    // 🎨 ASSETS KOPIEREN (von benches/ ins Root-Verzeichnis)
    // Kopiert benches/js/ nach ./js/
    eleventyConfig.addPassthroughCopy("js"); 
    // Kopiert benches/style.css nach ./style.css
    eleventyConfig.addPassthroughCopy("style.css"); 
    // Kopiert benches/OB.png nach ./OB.png
    eleventyConfig.addPassthroughCopy("OB.png"); 
    
    // Optional: Falls Sie auch einen Ordner namens 'stylesheet' (wie früher) haben:
    // eleventyConfig.addPassthroughCopy("stylesheet"); 
    
    // ⚙️ KONFIGURATION BEIBEHALTEN
    eleventyConfig.setTemplateFormats(["njk", "md"]);
    
    return {
        // Definiert benches als Input und Root (.) als Output
        dir: {
            input: "benches",
            output: "."
        }
    };
};
