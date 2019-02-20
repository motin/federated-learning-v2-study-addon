/* global PREFS, ModelSynchronization, svmLoss, FrecencyOptimizer */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "(feature)" }]*/

class Feature {
  constructor() {}

  /**
   *
   *  - variation: study info about particular client study variation
   *  - reason: string of background.js install/startup/shutdown reason
   *
   * @param {Object} studyInfo Study info
   * @returns {Promise<void>} Promise that resolves after configure
   */
  async configure(studyInfo) {
    const synchronizer = new ModelSynchronization(studyInfo);
    const optimizer = new FrecencyOptimizer(synchronizer, svmLoss);

    browser.experiments.awesomeBar.onHistorySearch.addListener(
      (urls, selectedIndex, numTypedChars) => {
        optimizer.step(urls, selectedIndex, numTypedChars);
      },
    );
  }

  /* good practice to have the literal 'sending' be wrapped up */
  async sendTelemetry(payload) {
    if (await browser.privacyContext.aPrivateBrowserWindowIsOpen()) {
      // drop the ping - do not send any telemetry
      return false;
    }

    await browser.study.logger.debug(
      "Telemetry about to be validated using browser.study.validateJSON",
    );
    const validationResult = await browser.study.validateJSON(payload, {
      type: "object",
      properties: {
        frecency_scores: { type: "array", items: { type: "number" } },
        model_version: { type: "number" },
        loss: { type: "number" },
        num_chars_typed: { type: "number" },
        num_suggestions_displayed: { type: "number" },
        rank_selected: { type: "number" },
        study_variation: { type: "string" },
        update: { type: "array", items: { type: "number" } },
      },
    });
    if (!validationResult.valid) {
      await browser.study.logger.error(["Invalid telemetry payload", payload]);
      throw new Error(validationResult);
    }

    // Submit ping using the frecency-update schema/topic - will be picked up by the streaming ETL job
    await browser.telemetry.submitPing("frecency-update", payload, {
      addClientId: true,
    });

    // Also submit ping using study utils - allows for automatic querying of study data in re:dash
    const stringStringMap = {
      model_version: String(payload.model_version),
      frecency_scores: JSON.stringify(payload.frecency_scores),
      loss: String(payload.loss),
      update: JSON.stringify(payload.update),
      num_suggestions_displayed: String(payload.num_suggestions_displayed),
      rank_selected: String(payload.rank_selected),
      num_chars_typed: String(payload.num_chars_typed),
      study_variation: String(payload.study_variation),
    };
    await browser.study.sendTelemetry(stringStringMap);
    await browser.study.logger.log("Telemetry submitted");
    return true;
  }

  /**
   * Called at end of study, and if the user disables the study or it gets uninstalled by other means.
   * @returns {Promise<*>} Promise that resolves after cleanup
   */
  async cleanup() {
    await browser.study.logger.log("Cleaning up study-specific prefs");
    const promises = [];
    for (let i = 0; i < PREFS.length; i++) {
      promises.push(browser.experiments.prefs.clearUserPref(PREFS[i]));
    }
    return Promise.all(promises);
  }
}

// make an instance of the feature class available to background.js
// construct only. will be configured after setup
window.feature = new Feature();
