// Inhalt von: .eleventy.js

module.exports = function(eleventyConfig) {
    
    // Deaktiviert die Template-Verarbeitung für HTML-Dateien im Input-Ordner.
    // HTML-Dateien werden jetzt automatisch kopiert (Passthrough), 
    // anstatt sie als Liquid/Nunjucks zu parsen.
    eleventyConfig.setTemplateFormats([
        "njk", 
        "md", 
        // Füge hier weitere Formate hinzu, die du parsen willst (z.B. "liquid"), 
        // aber lasse "html" weg!
    ]);

    // Korrektur: Die Passthrough-Regel muss den Input-Ordner spezifisch beachten
    // Diese Regel ist nicht mehr notwendig, da setTemplateFormats das Problem löst.
    
    return {
        // Konfiguriert den Input/Output Ordner, falls nicht in der CLI gesetzt
        dir: {
            input: "benches",
            output: "."
        }
    };
};
