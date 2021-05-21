/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const utils = require("./utils.js");
const { By, until } = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const fs = require("fs").promises;
const assert = require('assert');

// The number of milliseconds to wait for some
// property to change in tests. This should be
// a long time to account for slow CI.
const WAIT_FOR_PROPERTY = 5000;

/**
* Find the element and perform an action on it.
*
* @param driver
*        The Selenium driver to use.
* @param element
*        The element to look for and execute actions on.
* @param action
*        A function in the form `e => {}` that will be called
*        and receive the element once ready.
*/
async function findAndAct(driver, element, action) {
  await driver.wait(until.elementLocated(element), WAIT_FOR_PROPERTY);
  await driver.findElement(element).then(e => action(e));
}

/**
* Returns all objects of a particularly type logged by the study extension for testing.
* @param type
*        The type of the objects to return. This is specified in the extension
*        through the 'type' parameter passed to the testingLogger callback in TestLogging
*/
async function getObjectsFromTestLog(objectType) {
  const fileContent = await fs.readFile('tests/output/stdout.out', 'utf8');
  const fileLines = fileContent.replace(/\\/g, '').split((/\r?\n/));

  const rallyObjectKey = `rallyTestingOutput.${objectType}`

  const startString = `console.debug: "${rallyObjectKey}: `

  const matchingLines = fileLines.filter(function (v) { return v.substring(0, startString.length) === startString });

  const matchingObjects = []
  for(const matchingLine of matchingLines) {
    // Cut off last character to remove trailing quotation mark
    matchingObjects.push(JSON.parse(matchingLine.slice(startString.length, -1)))
  }

  return matchingObjects
}

describe("Study Template integration test example", function () {
  // eslint-disable-next-line mocha/no-hooks-for-single-case
  beforeEach(async function () {
    this.driver = await utils.getFirefoxDriver(true);
  });

  // eslint-disable-next-line mocha/no-hooks-for-single-case
  afterEach(async function () {
    await this.driver.quit();
  });

  it("successfully installs the study", async function () {
    await this.driver.get(`file:///${__dirname}/index.html`);
    await this.driver.wait(until.titleIs("Installation Test"), WAIT_FOR_PROPERTY);
    await findAndAct(this.driver, By.id("install"), e => e.click());
    // switch to browser UI context to interact with Firefox add-on install prompts.
    await this.driver.setContext(firefox.Context.CHROME);
    await findAndAct(this.driver, By.css(`[label="Add"]`), e => e.click());
    await findAndAct(this.driver, By.css(`[label="Okay"]`), e => e.click());

    const initialDataObjects = await getObjectsFromTestLog("initialData");
    assert.strictEqual(initialDataObjects.length, 1);
    assert.strictEqual(initialDataObjects[ 0 ][ "TimeOffset" ], 240)
  });
});