import QrScanner from '../assets/qr-scanner.min.js';
QrScanner.WORKER_PATH = '../assets/qr-scanner-worker.min.js';

// qr code stuff
var qrScanner = null;
var timer;
var cart = {};
var employee = {};
var videoElem;
var scannerContainer;
var loginContainer;
var startButton;
var stopButton;
var isScanning = false;

window.onload = function () {
    // get the containers
    scannerContainer = document.getElementById('video-scanner');
    loginContainer = document.getElementById('login');

    // qr code stuff
    videoElem = document.getElementById('scanner');
    videoElem.setAttribute('width', window.outerWidth);
    videoElem.setAttribute('height', window.outerHeight);

    // qrScanner = new QrScanner(videoElem, result => console.log('decoded qr code:', result));
    qrScanner = new QrScanner(videoElem, result => {
        handleQRCode(result);
    });

    // set scanning buttons
    startButton = document.getElementById('start-button');
    stopButton = document.getElementById('stop-button');

    // initiate button listen events
    startButton.addEventListener('click', startScanning, false);
    stopButton.addEventListener('click', stopScanning, false);

    // listen for keypress
    document.addEventListener('keyup', doKeypress);

    // initiate the cart
    initiateCart();

    // Notes:
    // - nice to have the ability to modify item prices
    // - nice to have easy way for qr code generation
};

window.resize = function () {
    // hide the scanner
    scannerContainer.style.display = "none";

    // reset the scanner
    qrScanner.destroy();
    qrScanner = null;

    qrScanner = new QrScanner(videoElem, result => {
        handleQRCode(result);
    }, undefined, {
        videoWidth: window.outerWidth,
        videoHeight: window.outerHeight
    });
};

/**
 * detecting keypress
 */
function doKeypress(event) {
    console.log(event.key);
}

/**
 * Start scanning for qr codes
 */
function startScanning() {
    if (!isScanning) {
        // set is scanning
        isScanning = true;

        // check for camera
        if (!QrScanner.hasCamera()) {
            console.log('no camera available');
            return false;
        }

        // disable button
        startButton.disabled = true;

        // show the scanner
        scannerContainer.style.display = "block";

        // start the scanner
        qrScanner.start();

        // 10 second scanning timer
        timer = setTimeout(function () {
            stopScanning();
        }, 10000);
    }
}

function handleQRCode(result) {
    // play scan sound
    playBeep();

    // stop scanning
    stopScanning();

    // parse the json
    var data = JSON.parse(result);

    // data.type is required
    if (data.type == undefined) {
        console.log('no type declared');
        return false;
    }

    // handle qr code types
    if (data.type == 'employee') {
        handleEmployee(data);
    } else if (data.type == 'item') {
        if (employee.name != undefined) {
            handleItem(data);
        }
    } else if (data.type == 'payment') {
        if (employee.name != undefined && cart.items.length > 0) {
            data.total = cart.totals.grand;
            handlePayment(data);
        }
    } else {
        console.log('No valid type.');
        return false;
    }
}

/**
 * Handle employee data type
 */
function handleEmployee(data) {
    // check required data
    if (data.name == undefined || data.store == undefined) {
        console.log('employee missing data');
        return false;
    }

    // set the employee
    employee.name = data.name;
    employee.store = data.store;

    // load data on screen
    document.getElementById('employee-name').innerHTML = data.name;
    document.getElementById('store').innerHTML = data.store;

    // remove "cover" screen
    loginContainer.style.display = "none";
}

/**
 * 
 * Handle item data type
 */
function handleItem(data) {
    // check for required
    if (data.name == undefined || data.price == undefined || data.id == undefined) {
        console.log('item missing data');
        return false;
    }

    // modify price
    data.price = parseFloat(data.price);

    // add the item to the cart
    var hasItem = cartHasItem(data.id);

    // update the quantity and/or push
    if (hasItem !== false) {
        cart.items[hasItem].quantity++;
    } else {
        data.quantity = 1;
        cart.items.push(data);
    }

    // redo the totals
    calculatTotals();

    // draw the cart
    drawCart();
}

/**
 * Handle payment data type
 */
function handlePayment(data) {
    // check required data
    if (data.name == undefined || data.number == undefined) {
        console.log('payment missing data');
        return false;
    }

    // play register sound after 2 seconds
    setTimeout(function () {
        playRegister();
    }, 2000);

    // show data for payment
    document.getElementById('paid-amount').innerHTML = '<strong>Total Paid:</strong> $' + data.total.toFixed(2);
    document.getElementById('paid-name').innerHTML = '<strong>Name: </strong>' + data.name;
    document.getElementById('card-number').innerHTML = '<strong>Card Number</strong>' + data.number;

    // clear the cart
    initiateCart();
    drawCart();

    // after 10 seconds, clear the payment
    setTimeout(function () {
        document.getElementById('paid-amount').innerHTML = '';
        document.getElementById('paid-name').innerHTML = '';
        document.getElementById('card-number').innerHTML = '';
    }, 10000);
}

/**
 * Calculate cart totals
 */
function calculatTotals() {
    var subtotal = 0;

    // calculate subtotal
    for (var i = 0; i < cart.items.length; i++) {
        var itemTotal = cart.items[i].price * cart.items[i].quantity;
        subtotal = subtotal + itemTotal;
    }

    // calculat tax
    var tax = subtotal * 0.07;
    tax = parseFloat(tax);

    // calculate grand total
    var grand = subtotal + tax;

    // set the totals object
    cart.totals.subtotal = subtotal;
    cart.totals.tax = tax;
    cart.totals.grand = grand;

    return true;
}

/**
 * Does cart have item
 */
function cartHasItem(id) {
    for (var i = 0; i < cart.items.length; i++) {
        if (id == cart.items[i].id) {
            return i;
        }
    }

    return false;
}

/**
 * Remove an item from the cart
 */
function removeItem(event) {
    var item = event.target;

    var uuid = item.getAttribute('data-uuid');

    var hasItem = cartHasItem(uuid);

    // remove the item if we find it
    if (hasItem !== false) {
        cart.items.splice(hasItem, 1);
    }

    // redo the totals
    calculatTotals();

    // draw the cart
    drawCart();
}

/**
 * 
 * Draw the cart on screen 
 */
function drawCart() {
    var cartHtml = '';

    // loop through and create the html
    for (var i = 0; i < cart.items.length; i++) {
        cartHtml += '<tr><th scope="row"><img src="' + cart.items[i].image + '" /></th><td>' + cart.items[i].name + '</td><td>$' + cart.items[i].price.toFixed(2) + '</td><td>' + cart.items[i].quantity + '</td><td><a data-uuid="' + cart.items[i].id + '" class="remove-item">Remove</a></td></tr>';
    }

    // get the cart element
    var cartElem = document.getElementById('cart');

    // set the html
    cartElem.innerHTML = cartHtml;

    // draw totals
    document.getElementById('subtotal').innerHTML = cart.totals.subtotal.toFixed(2);
    document.getElementById('tax').innerHTML = cart.totals.tax.toFixed(2);
    document.getElementById('grand').innerHTML = cart.totals.grand.toFixed(2);

    // get all of the remove elements
    var items = document.getElementsByClassName('remove-item');

    // add event listeners
    for (var x = 0; x < items.length; x++) {
        items[x].addEventListener('click', removeItem, false);
    }
}

/**
 * Initialize the cart
 */
function initiateCart() {
    cart.items = [];
    cart.payment = null;
    cart.totals = {
        subtotal: 0,
        tax: 0,
        grand: 0
    };

    // clear totals
    document.getElementById('subtotal').innerHTML = '0.00';
    document.getElementById('tax').innerHTML = '0.00';
    document.getElementById('grand').innerHTML = '0.00';
}

/**
 * Initialize the employee
 */
function initializeEmployee(data) {
    employee = data;
}

/**
 * Remove employee
 */
function removeEmployee() {
    employee = null;

    // re-draw the login screen
    // and clear employee data on screen
}

/**
 * Play scanning beep sound
 */
function playBeep() {
    var audio = new Audio("../sounds/beep.mp3");
    audio.play();
}

/**
 * Play cash register sound
 */
function playRegister() {
    var audio = new Audio("../sounds/register.wav");
    audio.play();
}

/**
 * Stop scanning for codes
 */
function stopScanning() {
    // unset scanning flag
    isScanning = false;
    // enable the scan button
    startButton.disabled = false;
    // hide the scanner
    scannerContainer.style.display = "none";

    clearTimeout(timer);
    qrScanner.stop();
}