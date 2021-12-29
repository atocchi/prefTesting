const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const puppeteer = require('puppeteer');
const lighthouse = require('lighthouse');
const request = require('request');
const util = require('util');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

(async() => {
const arg = process.argv.slice(1);
const URL = arg[1];
const user = arg[2];
const pass = arg[3];
const headless = arg[4];
const BASE_URL = URL.split('.com')[0] + '.com'
console.log(BASE_URL)
const opts = {
  chromeFlags: '--headless',
  logLevel: 'info',
  output: 'json',
  preset: "desktop",
  disableStorageReset: true
};
if(headless === '-h'){
  opts.chromeFlags= '--headless'
}
// Launch chrome using chrome-launcher.
const chrome = await chromeLauncher.launch(opts);
opts.port = chrome.port;

// Connect to it using puppeteer.connect().
const resp = await util.promisify(request)(`http://localhost:${opts.port}/json/version`);
const {webSocketDebuggerUrl} = JSON.parse(resp.body);
const browser = await puppeteer.connect({browserWSEndpoint: webSocketDebuggerUrl});

const page = await browser.newPage();
await page.goto(`${BASE_URL}/login`);
const emailInput = await page.$('input[type="email"]');
await emailInput.type(user);
const passwordInput = await page.$('input[type="password"]');
await passwordInput.type(pass);
// const buttonSubmit = await page.$('button[type="submit"]')
await page.click('button');
const context = browser.defaultBrowserContext();
//set allow GPS somewhere near Palo Alto
await context.overridePermissions(`${BASE_URL}/explore`, ['geolocation']);
await page.setGeolocation({latitude: parseFloat(37.420814358159916), longitude: parseFloat(-122.15313958079074)});
await page.waitForNavigation();
console.log('Logged in and Geo Location Accepted')
await page.close();
// close session for next run


//headers and output for CSV file
const csvWriter = createCsvWriter({
  path: 'out.csv',
  header: [
    {id: 'url', title: 'URL'},
    {id: 'time', title: 'Timestamp'},
    {id: 'performance', title: 'Performance'},
    {id: 'accessibility', title: 'Accessibility'},
    {id: 'bestPractices', title: 'Best Practices'},
    {id: 'seo', title: 'SEO'},
    {id: 'pwa', title: 'PWA'},
  ],
  append: true
});

// Run Lighthouse.
const {lhr}  = await lighthouse(URL, opts, null);
let arr = Object.values(lhr.categories).map(c => c.score)
console.log(`Lighthouse scores: ${Object.values(lhr.categories).map(c => c.score).join(', ')}`);
//create data object to write to CSV file
const data = [
  {
    url: URL,
    time: Date.now(),
    performance: arr[0],
    accessibility: arr[1], 
    bestPractices: arr[2],
    seo: arr[3],
    pwa: arr[4]
  }
];

csvWriter
  .writeRecords(data)
  .then(()=> console.log('The CSV file was written successfully'));

await browser.disconnect();
await chrome.kill();
await browser.close();

})();