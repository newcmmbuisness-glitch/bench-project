// Inhalt von: .eleventy.js

module.exports = function(eleventyConfig) {
    
    // Deaktiviert das Parsen von .html Dateien
    eleventyConfig.setTemplateFormats([
        "njk", 
        "md", 
    ]);

    // WICHTIG: KEIN RETURN-BLOCK MEHR. Eleventy nimmt alle Standardeinstellungen
    // und wird dann nur durch den permalink gesteuert.
};
