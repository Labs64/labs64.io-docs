---
title: Justfiles
parent: Community & Contributing
nav_order: 9
---

# Justfiles: where to run what, and how to add a recipe

Every Labs64.IO repository you operate with runs its tasks through [`just`](https://just.systems). This page is the
one convention they all follow, so that a command means the same thing wherever you type it and a new recipe has
an obvious place. `just check-just` (part of `just check` in the workspace) enforces it.

## Start in the workspace

Run everything from `labs64.io-workspace/`. The other repositories are mounted there as **modules** named after
the repository without its `labs64.io-` prefix, and a module's recipes run in that repository's folder:

| From the workspace | Runs in | For |
| --- | --- | --- |
| `just <recipe>` | `labs64.io-workspace/` | the golden path: `just doctor`, `just clone`, `just up`, `just smoke`, `just down`, cross-repository gates |
| `just helm-charts <recipe>` | `labs64.io-helm-charts/` | the local cluster in detail (one app, one tool), chart authoring and releases |
| `just tests <recipe>` | `labs64.io-tests/` | one suite, one module, one file, the PSP stub |
| `just ee <recipe>` | the private EE workspace, when it is cloned | internal repositories, mounted the same way below it |

`just <module>` alone lists that module's recipes. A module whose repository is not cloned is simply absent
from the list. Inside a repository, `just <recipe>` works as before; the workspace only saves you the `cd`.

```bash
just up                                   # build every image, create the local cluster, deploy
just helm-charts install-app auditflow    # reinstall one module after a change
just tests test-module auditflow          # its regression suite
just helm-charts ci                       # what the charts' pull-request check runs
```

## The same name means the same thing

These names are reserved. A repository that has the task uses exactly this name, and no recipe uses one of these
names for anything else:

| Recipe | Means | Needs |
| --- | --- | --- |
| `just` | list the recipes, by group | nothing |
| `doctor` | check the tools this repository needs and their versions | nothing |
| `ci` | run what this repository's pull-request workflow runs, in the same order | no cluster, no cloud account |
| `test` | run this repository's own tests | its description says when they need a running stack |
| `lint` | static checks that change no file | nothing |
| `fmt` | rewrite files into their canonical format | nothing |
| `clean` | delete generated local files | nothing |
| `up`, `down` | create and deploy, or delete, the **local** stack | Docker |
| `deploy` | install or upgrade the stack in a cluster that already exists | a cluster |
| `status`, `logs` | read the state and the logs of the local stack | a running stack |
| `build` | build images | Docker |
| `clone`, `pull` | clone or update every repository next to the workspace | Git |

`ci` is the command to run before you push: when it passes locally, the pull-request check passes for the same
reasons, because the workflow calls the same recipes. Cloud environments use their own words for creating and
erasing an environment, never `up` and `down`, because those cost money or destroy data.

## Where a recipe lives

The root `justfile` holds only settings, variables, the `default` recipe and the list of files it imports. Every
recipe lives in `just/<group>.just`, and its `[group('…')]` attribute is the file's name with spaces:

| Group | File | What belongs in it |
| --- | --- | --- |
| `setup` | `just/setup.just` | once per machine, checkout or cloud account: tools, plugins, secrets files, sign-in |
| `repositories` | `just/repositories.just` | every clone at once: clone, pull, status, pull requests |
| `local stack` | `just/local-stack.just` | the local stack as a whole: create, deploy, inspect, open in the browser, delete |
| `local apps` | `just/local-apps.just` | one Labs64.IO module in the local cluster |
| `local tools` | `just/local-tools.just` | the third-party tools in the local cluster: gateway, identity provider, data stores, monitoring |
| `charts` | `just/charts.just` | writing and releasing the Helm charts: generated files, versions, image pins |
| `aws infrastructure` | `just/aws-infrastructure.just` | the Terraform of a cloud environment |
| `aws cluster` | `just/aws-cluster.just` | what is installed into a cloud environment's cluster |
| `aws operations` | `just/aws-operations.just` | day-to-day operation of a cloud environment: status, sleep and wake, alarms, logs, load tests |
| `aws tenants` | `just/aws-tenants.just` | one tenant in a cloud environment: its checks, relay, reports, archive |
| `tests` | `just/tests.just` | running test suites and reading their results |
| `psp stub` | `just/psp-stub.just` | the stand-in for the payment providers used by the payment tests |
| `quality gates` | `just/quality-gates.just` | `ci`, `test`, `lint`, `fmt` and every `check-*` |
| `cockpit` | `just/cockpit.just` | the local operations dashboard and the reports it reads |

The gate `just check-just` keeps its own copy of this list in `scripts/check-just.py`, so it also covers repositories that are not public; change both together.

A repository uses the groups it needs; `just` lists them in this order. Private helper recipes (`[private]`,
name starting with `_`) sit in the file of the recipes that call them. A recipe that has to run inside a
sub-folder says so with `[working-directory('terraform')]` instead of a `cd` in its body, so `just --show
<recipe>` tells you where it runs.

## Naming a recipe

- **Verb first**, then the object, in kebab-case: `install-app`, `show-edge`, `check-pins`, `generate-docs`.
- Use the verb that says what happens:

  | Verb | For | Verb | For |
  | --- | --- | --- | --- |
  | `install`, `uninstall` | a release in a cluster | `check` | a gate: exits non-zero on a finding, changes nothing |
  | `apply` | manifests or settings | `show` | print state, read-only |
  | `start`, `stop` | a local process or container | `list` | print a list, read-only |
  | `enable`, `disable` | switch a setting on or off | `open` | open a page in the browser |
  | `generate` | write derived files you commit | `run` | a one-off job, report or drill |
  | `update`, `sync` | refresh to the pinned or current state | `test`, `lint` | the tests or the static checks of one thing |
  | `provision`, `teardown` | a whole cloud environment | `bump`, `migrate`, `prune`, `delete` | what they say |

- The **first sentence above the recipe** is its description in `just --list`: imperative, one line, says what
  it does and, if it is not obvious, what it needs ("…; needs a running local cluster"). Longer explanations go
  in the comment lines above that sentence.
- **Arguments are positional.** Write `just helm-charts install-app auditflow`, never `just helm-charts install-app app=auditflow` (that names an app literally called `app=auditflow`).
- **A recipe that touches a cloud account takes the environment as its first argument, without a default.**
  The AWS recipes of the internal repository (`just ee devops plan dev`) refuse to run without one: no environment is an error, not a change to whichever one happens to be the default.

## Adding or changing a recipe

1. Pick the group from the table above; add the recipe to that file. Reuse a reserved name only for its meaning.
2. Write the description line and the `[group('…')]` attribute.
3. If CI should run it, add it to `ci` **and** call it from the workflow as `just <recipe>`. The workflow
   never repeats the commands themselves, so the two cannot drift.
4. Update the documentation that names the old behaviour.
5. Run `just check-just` from the workspace: it fails on a recipe without a group or description, on a
   reference to a recipe that does not exist (in a workflow, a script or the documentation), and on an
   environment parameter with a default.

**Renaming a recipe:** add the old name to `just/renamed.just` as a private recipe that fails and names the new
one, so muscle memory and old scripts get a clear message instead of a different behaviour:

```just
[private]
old-name *args:
    @just _renamed old-name new-name
```

Update every reference in the same change; `just check-just` reports the ones you missed. A renamed entry is
removed once nobody has used the old name for a release cycle (the date is in the file).
