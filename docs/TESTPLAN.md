# Test plan for this add-on

<!-- START doctoc generated TOC please keep comment here to allow auto update -->

<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

**Contents**

* [Manual / QA TEST Instructions](#manual--qa-test-instructions)
  * [Preparations](#preparations)
  * [Install the add-on and enroll in the study](#install-the-add-on-and-enroll-in-the-study)
* [Expected User Experience / Functionality](#expected-user-experience--functionality)
  * [Surveys](#surveys)
  * [Do these tests (in addition to ordinary regression tests)](#do-these-tests-in-addition-to-ordinary-regression-tests)
  * [Note: checking "sent Telemetry is correct"](#note-checking-sent-telemetry-is-correct)
* [Debug](#debug)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Manual / QA TEST Instructions

### Preparations

* Download a Release version of Firefox

### Install the add-on and enroll in the study

* (Create profile: <https://developer.mozilla.org/Firefox/Multiple_profiles>, or via some other method)
* Navigate to _about:config_ and set the following preferences. (If a preference does not exist, create it be right-clicking in the white area and selecting New -> String)
* Set `shieldStudy.logLevel` to `info`. This permits shield-add-on log output in browser console.
* Set `extensions.federated-learning-v2_shield_mozilla_org.test.variationName` to `model1` (or any other study variation/branch to test specifically)
* Go to [this study's tracking bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1532217) and install the latest add-on zip file
* (If you are installing an unsigned version of the add-on, you need to set `extensions.legacy.enabled` to `true` before installing the add-on)

## Expected User Experience / Functionality

No user interface elements are modified directly in this study.

The awesome bar is observed and an updated model is calculated and submitted via telemetry after every interaction.

Depending on the study branch (see `branchConfigurations` in [../src/feature.js](../src/feature.js)), a remote model may be fetched and applied locally (`validation: true`).

When a model has been applied locally, the ranking of the autocomplete suggestions related to bookmarks and browser history is expected to differ from the ordinary behavior.

### Surveys

The main survey fires mid study 5 seconds after the second awesome bar interaction that occurs sometime after 14-21 days (interval chosen randomly for each client).

In case no such survey has been fired, the survey fires at the following endings:

* `individual-opt-out` (A user opts out of the study from `about:studies`)
* `expired` (4 weeks has passed since the study started)

### Do these tests (in addition to ordinary regression tests)

**Fetching of the latest upstream model at study start**

* Install the add-on as per above, not using the control branch
* Verify that the study runs
* Verify that the study add-on log out includes "Fetching model" and "Applying frecency weights"

**Fetching of the latest upstream model periodically**

* Install the add-on as per above, not using the control branch
* Verify that the study runs
* Verify that the study add-on log out includes "Fetching model" and "Applying frecency weights" every 5 minutes, starting from a full hour (eg 12:00, 12:05, 12:10 etc)

**Sending of the updated model and interaction metadata**

* Install the add-on as per above, not using the control branch
* Verify that the study runs
* Interact with the awesome bar (start: focus the element. stop: select suggestion / unfocus / press escape / press enter etc)
* Verify that sent shield telemetry is correct
* Verify that `frecency-update` telemetry is sent in all branches except `control` and those ending with `-not-submitting`

**Sending of the updated model and interaction metadata on history/bookmark related search suggestion selected**

* Install the add-on as per above, not using the control branch
* Verify that the study runs
* Open up a new tab and write "example.com" + ENTER
* Close the tab
* Open up a new tab and start writing "example.com"
* Instead of pressing ENTER, choose the "example.com" history entry in the suggestions that are shown (history entries have a wireframe globe as an icon)
* Verify that sent shield telemetry is correct
* Verify that `frecency-update` telemetry is sent in all branches except `control` and those ending with `-not-submitting`

**Mid-study survey fires properly test 1**

* Install the add-on as per above
* Verify that the study runs
* Verify that the study add-on log out includes "The mid-study survey period is set to start # days before expiration", where # is a number between 7 and 14.
* Interact two times with the awesome bar
* Verify that no mid-study survey is fired after 5 seconds

**Mid-study survey fires properly test 2**

* Set `extensions.federated-learning-v2_shield_mozilla_org.test.surveyDaysFromExpiration` to `1000`
* Install the add-on as per above
* Verify that the study runs
* Verify that the study add-on log out includes "The mid-study survey period is set to start 1000 days before expiration".
* Interact two times with the awesome bar
* Verify that the mid-study survey is fired after 5 seconds

**Enabling of permanent private browsing before study has begun**

* Enable permanent private browsing
* Install the add-on as per above
* Verify that the study does not run

**Private browsing mode test 1**

* Install the add-on as per above
* Verify that the study runs
* Verify that no information is recorded and sent when private browsing mode is active

**Not showing in `about:addons`**

* Install the add-on as per above
* Verify that the study runs
* Verify that the study does not show up in `about:addons` (note: only signed study add-ons are hidden)

**Cleans up preferences upon Normandy unenrollment**

* Set the branch preference to one of the validation branches
* Enroll a client using the Normandy staging server
* Verify that the study runs
* Verify that `places.frecency.firstBucketCutoff` has a non-default value
* Unenroll a client using the Normandy staging server
* Verify that `places.frecency.firstBucketCutoff` has been restored to use the default value

**Correct branches and weights**

* Make sure that the branches and weights in the add-on configuration ([../src/studySetup.js](../src/studySetup.js)) corresponds to the branch weights of the Experimenter entry. (They don't need to be verbatim identically named, but at least correspond to the same weights. Note that for practical reasons, the implementation uses 7 branches instead of the 5 defined study branches. The study branches that separate use different populations for training and validation corresponding to separate branches in the implementation)

### Note: checking "sent Telemetry is correct"

* Open the Browser Console using Firefox's top menu at `Tools > Web Developer > Browser Console`. This will display Shield (loading/telemetry) log output from the add-on.
* To see the actual payloads, go to `about:telemetry` -> Click `current ping` -> Select `Archived ping data` -> Ping Type `pioneer-study` -> Choose a payload -> Raw Payload

See [TELEMETRY.md](./TELEMETRY.md) for more details on what pings are sent by this add-on.

## Debug

To debug installation and loading of the add-on:

* Open the Browser Console using Firefox's top menu at `Tools > Web Developer > Browser Console`. This will display Shield (loading/telemetry) and log output from the add-on.
* Set `shieldStudy.logLevel` to `all`. This permits debug-level shield-add-on log output in the browser console.
