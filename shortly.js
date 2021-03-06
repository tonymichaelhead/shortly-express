var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var bcrypt = require('bcrypt-nodejs');
var session = require('express-session');
var FileStore = require('session-file-store')(session);


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({key: 'keyhere', secret: 'supersecretyo'}));

app.get('/', 
function(req, res) {
  if (req.session.auth) {
    res.render('index');
  } else {
    res.render('login');
  }
});

app.get('/logout', 
function(req, res) {
  if (req.session.auth) {
    req.session.auth = false;
    res.render('login');
  } else {
    res.render('login');
  }
});

app.get('/create', 
function(req, res) {
  if (req.session.auth) {
    res.render('index');
  } else {
    res.render('login');
  }
});

app.get('/signup',
function(req, res) {
  res.render('signup');
})

app.get('/links', 
function(req, res) {
  if (req.session.auth) {
    Links.reset().fetch().then(function(links) {
      res.status(200).send(links.models);
    });
  } else {
    res.render('login');
  }
});

app.post('/login',
function(req, res) {
  //query table
  User.where('username', req.body.username).fetch().then( (user) => {
    console.log('hashed password is: ' + user.attributes.password)
    let hashedPass = user.attributes.password;
    let submittedPass = req.body.password;
    console.log(bcrypt.compareSync(submittedPass, hashedPass))
    if (bcrypt.compareSync(submittedPass, hashedPass)) {
      console.log('Youve been logged in! Maybe...muhahaha');
      //give em da token
      req.session.auth = true;
      res.redirect(301, 'index');
    } else {
      console.log('wrong password bruh');
    }
  }).catch( (err) => {
    console.error(err);
  })
});

app.post('/signup',
function(req, res) {
  console.log(req.body.password);
  var hashPass = bcrypt.hashSync(req.body.password);
  let newUser = new User( {username: req.body.username, password: hashPass} );
  newUser.save(null, {method: 'insert'});
  req.session.auth = true;
  res.redirect(301, 'index');
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }



  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

var checkUser = (url) => {
  //check routes that need to verify login
  //if not logged in, redirect to login page
  //allow through if logged in
}


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

module.exports = app;
