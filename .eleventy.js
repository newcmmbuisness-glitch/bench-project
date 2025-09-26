// Inhalt von: .eleventy.js

module.exports = function(eleventyConfig) {
    // Kopiert benches/js/ → ./js/
    eleventyConfig.addPassthroughCopy("benches/js"); 
    // Kopiert benches/style.css → ./style.css
    eleventyConfig.addPassthroughCopy("benches/style.css"); 
    // Kopiert benches/OB.png → ./OB.png
    eleventyConfig.addPassthroughCopy("benches/OB.png"); 

    eleventyConfig.setTemplateFormats(["njk", "md"]);

    return {
        dir: {
            input: "benches",
            output: "."
        }
    };
};

