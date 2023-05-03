# PostyFox

PostyFox is a fork of [PostyBirb+](https://github.com/mvdicarlo/postybirb-plus) developed by Lemonynade. The idea of this fork is to add features that I'm working on and provide test builds quickly. It will, at times, have features that are not in PostyBirb+ and may in the future deviate.

Core technologies used in the application are TypeScript, NestJS, React and Electron.

## [Commons](/commons)
Shared interfaces, models, etc. between the UI and Backend

## [Electron-App](/electron-app) (backend)
ElectronJS + NestJs that handles running the local server and the desktop application itself.
This is where all posting magic happens.

## [UI](/ui)
React code that handles UI of the application displayed in the desktop application.

## Configuring for local development

To set up a local copy of PostyBirb for development:

1. clone this repository and `cd` into it.
2. `npm install` to install the base requirements.
3. For the `commons`, `ui`, and `electron-app` directories, cd into each and run `npm install`. Be sure to start with commons first.

Then, from the base directory again, run:

```bash
npm run make && npm run start --prefix electron-app
```

This will build and run the application. After making changes, close out of the app and run the above command again to rebuild and run with your changes.

## Contribution Guide

### Prerequisites
nodejs v14

### Commands

```npm install``` <= this will run install for *all* projects and make sure all requirements are installed

```npm run build``` <= will build all projects

```cd ./electron-app```
```npm run start``` <= will start the version you have coded up

### Submitting Contributions

Create a fork, branch, and submit a PR :)
