'use strict';

module.exports.route = route;
module.exports.login = login;
module.exports.open = openUrl;
module.exports.changeUrl = changeUrl;
module.exports.printLogs = printLogs;
module.exports.waitForSuperdesk = waitForSuperdesk;
module.exports.nav = nav;
module.exports.getListOption = getListOption;
module.exports.ctrlKey = ctrlKey;
module.exports.commandKey = commandKey;
module.exports.ctrlShiftKey = ctrlShiftKey;
module.exports.altKey = altKey;
module.exports.assertToastMsg = assertToastMsg;
module.exports.wait = wait;
module.exports.hover = hover;

// construct url from uri and base url
exports.constructUrl = function(base, uri) {
    return base.replace(/\/$/, '') + uri;
};

var LoginModal = require('./pages').login;

// authenticate if needed
function login(username, password) {
    username = username || 'admin';
    password = password || 'admin';
    var modal = new LoginModal();
    return modal.btn.isDisplayed()
        .then(function(needLogin) {
            if (needLogin) {
                return modal.login(username, password);
            }
        });
}

// open url
function changeUrl(url) {
    return browser.get(url).then(waitForSuperdesk);
}

// open url and authenticate
function openUrl(url) {
    return browser.get(url)
        .then(login)
        .then(waitForSuperdesk);
}

function printLogs(prefix) {
    prefix = prefix ? (prefix + ' ') : '';
    return browser.manage().logs().get('browser').then(function(browserLog) {
        var logs = browserLog.filter(function(log) {
            return log.level.value >= 1000;
        });

        console.info(prefix + 'log: ' + require('util').inspect(logs, {dept: 3}));
    });
}

function waitForSuperdesk() {
    return browser.driver.wait(function() {
        return browser.driver.executeScript('return window.superdeskIsReady || false');
    }, 5000, '"window.superdeskIsReady" is not here');
}

/**
 * Navigate to given location.
 *
 * Unlinke openUrl it doesn't reload the page, only changes #hash in url
 *
 * @param {string} location Location where to navigate without # (eg. users, workspace/content)
 * @return {Promise}
 */
function nav(location) {
    return login().then(function() {
        return browser.setLocation(location);
    });
}

/**
 * Nav shortcut for beforeEach, use like `beforeEach(route('/workspace'));`
 *
 * @param {string} location
 * @return {function}
 */
function route(location) {
    return function() {
        nav(location);
    };
}

/**
 * Finds and returns the n-th <option> element of the given dropdown list
 *
 * @param {ElementFinder} dropdown - the <select> element to pick the option from
 * @param {number} n - the option's position in the dropdown's list of options,
 *   must be an integer (NOTE: list positions start with 1!)
 *
 * @return {ElementFinder} the option element itself (NOTE: might not exist)
 */
function getListOption(dropdown, n) {
    var cssSelector = 'option:nth-child(' + n + ')';
    return dropdown.$(cssSelector);
}

/**
 * Performs CTRL + key action
 *
 * @param {char} key
 */
function ctrlKey(key) {
    var Key = protractor.Key;
    browser.actions().sendKeys(Key.chord(Key.CONTROL, key)).perform();
}

/**
 * Performs COMMAND + key action
 *
 * @param {char} key
 */
function commandKey(key) {
    var Key = protractor.Key;
    browser.actions().sendKeys(Key.chord(Key.COMMAND, key)).perform();
}

/**
 * Performs CTRL + SHIFT + key action
 *
 * @param {char} key
 */
function ctrlShiftKey(key) {
    var Key = protractor.Key;
    browser.actions().sendKeys(Key.chord(Key.CONTROL, Key.SHIFT, key)).perform();
}

/**
 * Performs ALT + key action
 *
 * @param {char} key
 */
function altKey(key) {
    var Key = protractor.Key;
    browser.actions().sendKeys(Key.chord(Key.ALT, key)).perform();
}

/**
 * Asserts that a toast message of a particular type has appeared with its
 * message containing the given string.
 *
 * A workaround with setting the ignoreSyncronization flag is needed due to a
 * protractor issue that does not find DOM elements dynamically displayed in a
 * $timeout callback. More info here:
 *    http://stackoverflow.com/questions/25062748/
 *           testing-the-contents-of-a-temporary-element-with-protractor
 *
 * @param {string} type - type of the toast notificiation ("info", "success" or
 *   "error")
 * @param {string} msg - a string expected to be present in the toast message
 */
function assertToastMsg(type, msg) {
    var cssSelector = '.notification-holder .alert-' + type,
        toast = $(cssSelector);

    browser.sleep(500);
    browser.ignoreSynchronization = true;
    expect(toast.getText()).toContain(msg);
    browser.sleep(500);
    browser.ignoreSynchronization = false;
}

/**
 * Wait for element to be displayed
 *
 * @param {Element} elem
 * @param {number} time
 * @return {Promise}
 */
function wait(elem, time) {
    return browser.wait(function() {
        return elem.isDisplayed();
    }, time || 500);
}

/**
 * Move mouse over given elem
 *
 * @param {Element} elem
 */
function hover(elem) {
    browser.actions().mouseMove(elem, {x: 3, y: 3}).perform();
}
