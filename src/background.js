/* global getStudySetup, feature */

/**
 *  Goal:  Implement an instrumented feature using `browser.study` API
 *
 *  Every runtime:
 *  - Prepare
 *
 *    - listen for `onEndStudy` (study endings)
 *    - listen for `study.onReady`
 *
 *  - Startup the feature
 *
 *    - attempt to `browser.study.setup` the study using our studySetup
 *
 *      - will fire EITHER
 *        -  `endStudy` (`expired`, `ineligible`)
 *        - onReady
 *      - (see docs for `browser.study.setup`)
 *
 *    - onReady: configure the feature to match the `variation` study selected
 *    - or, if we got an `onEndStudy` cleanup and uninstall.
 *
 *  During the feature:
 *    - `sendTelemetry` to send pings
 *    - `endStudy` to force an ending (for positive or negative reasons!)
 *
 *  Interesting things to try next:
 *  - `browser.study.validateJSON` your pings before sending
 *  - `endStudy` different endings in response to user action
 *  - force an override of setup.testing to choose branches.
 *
 */

class StudyLifeCycleHandler {
  /**
   * Listen to onEndStudy, onReady
   * `browser.study.setup` fires onReady OR onEndStudy
   *
   * call `this.enableFeature` to actually do the feature/experience/ui.
   */
  constructor() {
    /*
     * IMPORTANT:  Listen for `onEndStudy` before calling `browser.study.setup`
     * because:
     * - `setup` can end with 'ineligible' due to 'allowEnroll' key in first session.
     *
     */
    browser.study.onEndStudy.addListener(this.handleStudyEnding.bind(this));
    browser.study.onReady.addListener(this.enableFeature.bind(this));
    this.expirationAlarmName = `${browser.runtime.id}:studyExpiration`;
    this.midStudySurveyAlarmName = `${browser.runtime.id}:midStudySurvey`;
  }

  /**
   * Cleanup
   *
   * (If you have privileged code, you might need to clean
   *  that up as well.
   * See:  https://firefox-source-docs.mozilla.org/toolkit/components/extensions/webextensions/lifecycle.html
   *
   * @returns {undefined}
   */
  async cleanup() {
    await browser.study.logger.log("Cleaning up study artifacts");
    await browser.storage.local.clear();
    await browser.alarms.clear(this.expirationAlarmName);
    await browser.alarms.clear(this.midStudySurveyAlarmName);
    await feature.cleanup();
  }

  /**
   *
   * side effects
   * - set up expiration alarms
   * - make feature/experience/ui with the particular variation for this user.
   *
   * @param {object} studyInfo browser.study.studyInfo object
   *
   * @returns {undefined}
   */
  async enableFeature(studyInfo) {
    await browser.study.logger.log(["Enabling experiment", studyInfo]);
    const { delayInMinutes } = studyInfo;
    if (delayInMinutes !== undefined) {
      await browser.study.logger.log("Scheduling study expiration");
      const alarmName = this.expirationAlarmName;
      const alarmListener = async alarm => {
        if (alarm.name === alarmName) {
          browser.alarms.onAlarm.removeListener(alarmListener);
          await browser.study.endStudy("expired");
        }
      };
      browser.alarms.onAlarm.addListener(alarmListener);
      browser.alarms.create(alarmName, {
        delayInMinutes,
      });
      const { midStudySurveyFired } = await browser.storage.local.get(
        "midStudySurveyFired",
      );
      if (!midStudySurveyFired) {
        await this.enableMidStudySurvey(delayInMinutes);
      }
    }
    return feature.configure(studyInfo);
  }

  /**
   * Set up mid-study survey period
   *
   * @param {number} delayInMinutes The study expires in this amount of minutes
   *
   * @returns {undefined}
   */
  async enableMidStudySurvey(delayInMinutes) {
    const surveyDaysFromExpiration = await this.surveyDaysFromExpiration();
    await browser.study.logger.log(
      `The mid-study survey period is set to start ${surveyDaysFromExpiration} days before expiration`,
    );
    const midStudySurveyPeriodStartsThisManyMinutesBeforeExpiration =
      surveyDaysFromExpiration * 24 * 60;
    if (
      // Check if we are already in the mid-study survey period
      delayInMinutes < midStudySurveyPeriodStartsThisManyMinutesBeforeExpiration
    ) {
      await browser.study.logger.log("The mid-study survey period has begun");
      await browser.storage.local.set({ midStudySurveyPeriodStarted: true });
    } else {
      await browser.study.logger.log(
        "Scheduling mid-study survey period start",
      );
      const alarmName = this.midStudySurveyAlarmName;
      const alarmListener = async alarm => {
        if (alarm.name === alarmName) {
          browser.alarms.onAlarm.removeListener(alarmListener);
          await browser.storage.local.set({
            midStudySurveyPeriodStarted: true,
          });
        }
      };
      browser.alarms.onAlarm.addListener(alarmListener);
      browser.alarms.create(alarmName, {
        delayInMinutes,
      });
    }
  }

  async surveyDaysFromExpiration() {
    const override = await browser.testingOverrides.getSurveyDaysFromExpirationOverride();
    if (override) {
      return override;
    }
    const { surveyDaysFromExpiration } = await browser.storage.local.get(
      "surveyDaysFromExpiration",
    );
    if (surveyDaysFromExpiration) {
      return surveyDaysFromExpiration;
    }
    // Set it to 7-14 days before expiration (corresponds to day 14-21 with a 4 week expiration)
    const days = 7 + Math.floor(7 * Math.random());
    await browser.storage.local.set({
      surveyDaysFromExpiration: days,
    });
    return days;
  }

  /** handles `study:end` signals
   *
   * - opens 'ending' urls (surveys, for example)
   * - calls cleanup
   *
   * @param {object} ending An ending result
   *
   * @returns {undefined}
   */
  async handleStudyEnding(ending) {
    await browser.study.logger.log([`Study wants to end:`, ending]);
    const { midStudySurveyFired } = await browser.storage.local.get(
      "midStudySurveyFired",
    );
    if (midStudySurveyFired !== true) {
      for (const url of ending.urls) {
        await browser.study.logger.log(
          "Firing end survey since mid-study survey was not fired",
        );
        await browser.tabs.create({ url });
      }
    }
    switch (ending.endingName) {
      // could have different actions depending on positive / ending names
      default:
        await browser.study.logger.log(`The ending: ${ending.endingName}`);
        await this.cleanup();
        break;
    }
    // actually remove the addon.
    await browser.study.logger.log("About to actually uninstall");
    return browser.management.uninstallSelf();
  }
}

/**
 * Run every startup to get config and instantiate the feature
 *
 * @returns {undefined}
 */
async function onEveryExtensionLoad() {
  new StudyLifeCycleHandler();

  const studySetup = await getStudySetup();
  await browser.study.logger.log([`Study setup: `, studySetup]);
  await browser.study.setup(studySetup);
}
onEveryExtensionLoad();
