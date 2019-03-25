/* global FRECENCY_PREFS, ModelSynchronization, svmLoss, FrecencyOptimizer, AwesomeBarObserver */
/* eslint no-unused-vars: ["error", { "varsIgnorePattern": "(feature)" }]*/

class Feature {
  constructor() {
    this.branchConfigurations = {
      control: {
        modelNumber: null,
        submitFrecencyUpdate: false,
      },
      model1: {
        modelNumber: 1,
        submitFrecencyUpdate: true,
      },
      model2: {
        modelNumber: 2,
        submitFrecencyUpdate: true,
      },
      "model3-submitting": {
        modelNumber: 3,
        submitFrecencyUpdate: true,
      },
      "model3-not-submitting": {
        modelNumber: 3,
        submitFrecencyUpdate: false,
      },
      "model4-submitting": {
        modelNumber: 4,
        submitFrecencyUpdate: true,
      },
      "model4-not-submitting": {
        modelNumber: 4,
        submitFrecencyUpdate: false,
      },
    };
  }

  /**
   * @param {Object} studyInfo Study info
   * @returns {Promise<*>} Promise that resolves after configure
   */
  async configure(studyInfo) {
    const synchronizer = new ModelSynchronization(studyInfo);
    this.awesomeBarObserver = new AwesomeBarObserver(synchronizer);
    return this.awesomeBarObserver.start();
  }

  /* good practice to have the literal 'sending' be wrapped up */
  async sendTelemetry(payload, submitFrecencyUpdate) {
    if (await browser.privacyContext.aPrivateBrowserWindowIsOpen()) {
      // drop the ping - do not send any telemetry
      return false;
    }

    await browser.study.logger.debug([
      "Telemetry about to be validated using browser.study.validateJSON",
      payload,
    ]);

    const payloadSchema = {
      type: "object",
      properties: {
        model_version: {
          type: "number",
        },
        frecency_scores: {
          type: "array",
          items: {
            type: "number",
          },
        },
        loss: {
          type: "number",
        },
        update: {
          type: "array",
          minItems: 22,
          maxItems: 22,
          items: {
            type: "number",
          },
        },
        num_suggestions_displayed: {
          type: "number",
          minimum: 0,
        },
        rank_selected: {
          type: "number",
          minimum: -1,
        },
        bookmark_and_history_num_suggestions_displayed: {
          type: "number",
          minimum: 0,
        },
        bookmark_and_history_rank_selected: {
          type: "number",
          minimum: -1,
        },
        num_key_down_events_at_selecteds_first_entry: {
          type: "number",
          minimum: -1,
        },
        num_key_down_events: {
          type: "number",
          minimum: 0,
        },
        time_start_interaction: {
          type: "number",
          minimum: 0,
        },
        time_end_interaction: {
          type: "number",
          minimum: 0,
        },
        time_at_selecteds_first_entry: {
          type: "number",
          minimum: -1,
        },
        search_string_length: {
          type: "number",
          minimum: 0,
        },
        selected_style: {
          type: "string",
        },
        selected_url_was_same_as_search_string: {
          type: "number",
          minimum: -1,
        },
        enter_was_pressed: {
          type: "number",
          minimum: -1,
        },
        study_variation: {
          type: "string",
        },
        study_addon_version: {
          type: "string",
        },
      },
      required: [
        "model_version",
        "frecency_scores",
        "loss",
        "update",
        "num_suggestions_displayed",
        "rank_selected",
        "bookmark_and_history_num_suggestions_displayed",
        "bookmark_and_history_rank_selected",
        "num_key_down_events_at_selecteds_first_entry",
        "num_key_down_events",
        "time_start_interaction",
        "time_end_interaction",
        "time_at_selecteds_first_entry",
        "search_string_length",
        "selected_style",
        "selected_url_was_same_as_search_string",
        "enter_was_pressed",
        "study_variation",
        "study_addon_version",
      ],
    };
    const validationResult = await browser.study.validateJSON(
      payload,
      payloadSchema,
    );

    // Use to update frecency-update.payload.schema.json
    // console.log(JSON.stringify(payloadSchema));

    if (!validationResult.valid) {
      await browser.study.logger.error([
        "Invalid telemetry payload",
        { payload, validationResult },
      ]);
      throw new Error("Invalid telemetry payload");
    }

    // Submit ping using the frecency-update schema/topic - will be picked up by the streaming ETL job
    if (submitFrecencyUpdate) {
      await browser.telemetry.submitPing("frecency-update", payload, {
        addClientId: true,
      });
      await browser.study.logger.log("Submitted `frecency-update` ping:");
      await browser.study.logger.log({ payload });
    }

    // Also submit ping using study utils - allows for automatic querying of study data in re:dash
    const shieldStudyAddonPayload = {
      model_version: String(payload.model_version),
      frecency_scores: JSON.stringify(payload.frecency_scores),
      loss: String(payload.loss),
      update: JSON.stringify(payload.update),
      num_suggestions_displayed: String(payload.num_suggestions_displayed),
      rank_selected: String(payload.rank_selected),
      bookmark_and_history_num_suggestions_displayed: String(
        payload.bookmark_and_history_num_suggestions_displayed,
      ),
      bookmark_and_history_rank_selected: String(
        payload.bookmark_and_history_rank_selected,
      ),
      num_key_down_events_at_selecteds_first_entry: String(
        payload.num_key_down_events_at_selecteds_first_entry,
      ),
      num_key_down_events: String(payload.num_key_down_events),
      time_start_interaction: String(payload.time_start_interaction),
      time_end_interaction: String(payload.time_end_interaction),
      time_at_selecteds_first_entry: String(
        payload.time_at_selecteds_first_entry,
      ),
      search_string_length: String(payload.search_string_length),
      selected_style: String(payload.selected_style),
      selected_url_was_same_as_search_string: String(
        payload.selected_url_was_same_as_search_string,
      ),
      enter_was_pressed: String(payload.enter_was_pressed),
      study_variation: String(payload.study_variation),
      study_addon_version: String(payload.study_addon_version),
    };
    await browser.study.sendTelemetry(shieldStudyAddonPayload);
    await browser.study.logger.log("Shield telemetry submitted:");
    await browser.study.logger.log({ shieldStudyAddonPayload });
    return true;
  }

  /**
   * Called at end of study, and if the user disables the study or it gets uninstalled by other means.
   * @returns {Promise<*>} Promise that resolves after cleanup
   */
  async cleanup() {
    if (this.awesomeBarObserver) {
      await this.awesomeBarObserver.stop();
    }
    await browser.study.logger.log("Cleaning up study-specific prefs");
    const promises = [];
    for (let i = 0; i < FRECENCY_PREFS.length; i++) {
      promises.push(browser.frecencyPrefs.clearUserPref(FRECENCY_PREFS[i]));
    }
    return Promise.all(promises);
  }
}

// make an instance of the feature class available to background.js
// construct only. will be configured after setup
window.feature = new Feature();
