// /* This Source Code Form is subject to the terms of the Mozilla Public
//  * License, v. 2.0. If a copy of the MPL was not distributed with this
//  * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// import "webextension-polyfill";

// import { Rally, runStates } from "@mozilla/rally";

// // Example: import a module.
// import { startStudy } from "./StudyModule";

// const rally = new Rally();

// async function runStudy() {
//   await startStudy(rally);
// }

// rally.initialize(
//   // A sample key id used for encrypting data.
//   "sample-invalid-key-id",
//   // A sample *valid* JWK object for the encryption.
//   {
//     "kty": "EC",
//     "crv": "P-256",
//     "x": "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
//     "y": "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
//     "kid": "Public key used in JWS spec Appendix A.3 example"
//   },
//   // The following constant is automatically provided by
//   // the build system.
//   // @ts-expect-error: Provided by build system
//   __ENABLE_DEVELOPER_MODE__,
//   (newState) => {
//     if (newState === runStates.RUNNING) {
//       console.log("The study can run.");
//     } else {
//       console.log("The study must stop.");
//     }
//   }
// ).then(_resolve => {
//   // Initialize the study and start it.
//   // Example: initialize the example module.
//   runStudy();
// }, _reject => {
//   // Do not start the study in this case. Something
//   // went wrong.
// });


import { startStudy } from "./StudyModule";
async function runStudy() {
  await startStudy(null);
}
runStudy()