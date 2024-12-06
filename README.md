# Pythia Shell V2

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 19.0.3.

This is version 2 of the Pythia UI development shell. Version 2 has been refactored into a standalone app and all its library versions have bumped to 6. The old version is being preserved in its [original repository](https://github.com/vedph/pythia-shell).

The app has been created with these commands:

```bash
ng new pythia-shell
ng add @angular/material
ng add @angular/localize

ng g library @myrmidon/pythia-api --prefix pythia
ng g library @myrmidon/pythia-core --prefix pythia
ng g library @myrmidon/pythia-corpus-list --prefix pythia
ng g library @myrmidon/pythia-document-list --prefix pythia
ng g library @myrmidon/pythia-document-reader --prefix pythia
ng g library @myrmidon/pythia-query-builder --prefix pythia
ng g library @myrmidon/pythia-search --prefix pythia
ng g library @myrmidon/pythia-stats --prefix pythia
ng g library @myrmidon/pythia-ui --prefix pythia
ng g library @myrmidon/pythia-word-index --prefix pythia

npm i @myrmidon/auth-jwt-admin @myrmidon/auth-jwt-login @myrmidon/cadmus-refs-lookup @myrmidon/ngx-tools @myrmidon/ngx-mat-tools @myrmidon/paged-data-browsers ngx-echarts ts-md5 --force

npm i --save-dev ngx-i18nsupport
```

Then the old code has been progressively imported and refactored for standalone.

## Docker

🐳 Quick **Docker image build**:

1. ensure that you have the target locale set. This is specified in `angular.json` under `projects/pythia-shell/architect/build/options/localize`. Set it to false to use the default (English) language, or to `[it]` for Italian.
2. `npm run build-lib`;
3. if you changed anything, run `npm run xi18n` to extract the messages and merge them with the existing translations if any;
4. update version in `env.js` (and in Docker compose scripts);
5. `ng build --configuration production`;
6. if you want to create the image for the non-localized version, update [Dockerfile](Dockerfile) accordingly;
7. `docker build . -t vedph2020/pythia-shell:4.0.2-it -t vedph2020/pythia-shell:latest` (replace with the current version; remove `-it` for the English version).

🌐 To **update localizable messages**:

1. run `ng extract-i18n --output-path src/locale` to generate the XLF file under `src/locale`.
2. use `npx xliffmerge --profile xliffmerge.json` to merge new entries into the corresponding translated file(s) (the profile is in `xliffmerge.json`).
3. use [Poedit](https://poedit.net/download) or similar to edit the localized messages file and add the corresponding translations.

>Note that the language(s) built are defined in [angular.json](angular.json) under `configurations`. Currently, in production we build both English and Italian; in development we just build Italian. You can change the development language at will, but be sure to include the desired language(s) for production build before creating Docker images.
