# Federated Learning v2 - Study Add-On

[![CircleCI badge](https://img.shields.io/circleci/project/github/mozilla/federated-learning-v2-study-addon/master.svg?label=CircleCI)](https://circleci.com/gh/mozilla/federated-learning-v2-study-addon/)
[![Coverage Status](https://coveralls.io/repos/github/mozilla/federated-learning-v2-study-addon/badge.svg)](https://coveralls.io/github/mozilla/federated-learning-v2-study-addon)

Federated Learning is a subarea of machine learning where the training process is distributed among many users.
Instead of sharing their data, users only have to provide weight updates to the server.

This is the second draft of a Firefox add-on study that implements the client-side part of a Federated Learning system.
Every time users perform searches in the awesome bar, the model's predictions are compared to the actual user behaviour and [frecency](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/Places/Frecency_algorithm) weight updates are computed.
These updates are collected using Telemetry.

## Seeing the add-on in action

See [TESTPLAN.md](./docs/TESTPLAN.md) for more details on how to get the add-on installed and tested.

## Data Collected / Telemetry Pings

See [TELEMETRY.md](./docs/TELEMETRY.md) for more details on what pings are sent by this add-on.

## Analyzing data

Telemetry pings are loaded into S3 and re:dash. Sample query:

* [All pings](https://sql.telemetry.mozilla.org/queries/61520/source)

## Improving this add-on

See [DEV.md](./docs/DEV.md) for more details on how to work with this add-on as a developer.

## References

### Version 2

* [Experimenter](https://experimenter.services.mozilla.com/experiments/federated-learning-v2/)
* [Bugzilla](https://bugzilla.mozilla.org/show_bug.cgi?id=1532217)

### Version 1

* [Blog post](https://florian.github.io/federated-learning/) explaining the concepts behind federated learning
* [Bugzilla](https://bugzilla.mozilla.org/show_bug.cgi?id=1462102)
* [Federated learning simulations](https://github.com/florian/federated-learning)
