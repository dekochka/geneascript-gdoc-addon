/**
 * Context block template for the Metric Book Transcriber Doc Builder.
 * Delegates to TemplateGallery.gs based on the selected template ID
 * stored in Document Properties. Falls back to the Galician Greek Catholic
 * context defaults if no template is set or lookup fails.
 *
 * Labels such as ARCHIVE_NAME, ARCHIVE_REFERENCE are wrapped in ** for bold
 * when rendered by insertFormattedText() in Code.gs.
 */
function getContextTemplateText() {
  try {
    var templateId = getSelectedTemplateId();
    return getContextDefaultsForTemplate(templateId);
  } catch (e) {
    Logger.log('getContextTemplateText: delegation failed, using Galician default. ' + e.message);
    return getGaliciaGcContextDefaults();
  }
}
