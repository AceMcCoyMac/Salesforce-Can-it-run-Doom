# Salesforce: Can it run Doom?

**Yes. Yes it can.**

This project implements Doom as a Lightning Web Component (LWC) exposed on a publicly accessible Salesforce Digital Experience site — so anyone on the internet can play Doom, served by Salesforce.

## What's in the box

- **Doom LWC** — the Lightning Web Component that will render and run Doom
- **Doom Tab** — a Lightning Web Component tab wired to the LWC
- **Doom App** — a custom Lightning app with the Doom logo
- **DoomLogo** — static resource containing the Doom wordmark
- **DoomPlayers Permission Set** — grants access to the app, tab, and LWC

## Architecture

```
Digital Experience Site (public)
    └── Doom LWC
            └── Doom game engine (JavaScript/WebAssembly)
```

The LWC is exposed on a public Salesforce Digital Experience site — no login required. Just visit the URL and rip and tear.

## Setup

### Prerequisites

- Salesforce CLI (`sf`)
- A Salesforce Dev Hub org

### Install

```bash
# Authenticate to your Dev Hub
sf org login web --set-default-dev-hub

# Create a scratch org
sf org create scratch --definition-file config/project-scratch-def.json --alias doom

# Deploy
sf project deploy start --target-org doom
```

## Package

This project is structured as an **unlocked package** for easy distribution and versioning.

```bash
# Create the package (first time)
sf package create --name "Doom" --type Unlocked --path force-app --no-namespace

# Create a package version
sf package version create --package Doom --installation-key-bypass --wait 10

# Install in a target org
sf package install --package <version-id> --target-org <org-alias>
```

## Why

Because "can it run Doom?" is the eternal question, and Salesforce has never been asked.

Until now.
