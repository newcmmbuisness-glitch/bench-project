// Inhalt von: .eleventy.js

module.exports = function(eleventyConfig) {
    // Die Pfade sind jetzt relativ zum "benches"-Ordner
    eleventyConfig.addPassthroughCopy("js"); 
    eleventyConfig.addPassthroughCopy("style.css"); 
    eleventyConfig.addPassthroughCopy("OB.png"); 

    eleventyConfig.setTemplateFormats(["njk", "md"]);

    return {
        dir: {
            input: "benches",
            // Dies legt die Ausgabe zurück in den Eingabeordner
            output: "benches" 
        }
    };
};

