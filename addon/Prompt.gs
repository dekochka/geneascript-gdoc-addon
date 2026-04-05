/**
 * Returns the prompt template for metric book transcription.
 * Delegates to TemplateGallery.gs based on the selected template ID
 * stored in Document Properties. Falls back to the Galician Greek Catholic
 * prompt if no template is set or lookup fails.
 *
 * Placeholder {{CONTEXT}} is replaced with the document's Context section
 * by buildPrompt() in Code.gs.
 */
function getPromptTemplate() {
  try {
    var templateId = getSelectedTemplateId();
    return getPromptForTemplate(templateId);
  } catch (e) {
    Logger.log('getPromptTemplate: delegation failed, using Galician default. ' + e.message);
    return getGaliciaGcPrompt();
  }
}
