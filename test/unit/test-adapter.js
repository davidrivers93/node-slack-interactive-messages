var http = require('http');
var assert = require('chai').assert;
var proxyquire = require('proxyquire');
var nop = require('nop');
var getRandomPort = require('get-random-port');
var systemUnderTest = require('../../dist/adapter');
var SlackMessageAdapter = systemUnderTest.default;

// fixtures and test helpers
var workingVerificationToken = 'VERIFICATION_TOKEN';

describe('SlackMessageAdapter', function () {
  describe('constructor', function () {
    it('should build an instance', function () {
      var adapter = new SlackMessageAdapter(workingVerificationToken);
      assert.instanceOf(adapter, SlackMessageAdapter);
    });
    it('should fail without a verification token', function () {
      assert.throws(function () {
        var adapter = new SlackMessageAdapter();  // eslint-disable-line no-unused-vars
      }, TypeError);
    });
  });

  describe('#createServer()', function () {
    beforeEach(function () {
      this.adapter = new SlackMessageAdapter(workingVerificationToken);
    });
    describe('when express package is not found', function () {
      beforeEach(function () {
        var SlackMessageAdapterNoExpress = proxyquire('../../dist/adapter', { express: null }).default;
        this.adapter = new SlackMessageAdapterNoExpress(workingVerificationToken);
      });
      it('should reject', function () {
        return this.adapter.createServer()
          .then(function (server) {
            assert.isNotOk(server, 'a server was created');
          })
          .catch(function (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
              assert(true);
            } else {
              throw error;
            }
          });
      });
    });

    describe('when body-parser package is not found', function () {
      beforeEach(function () {
        var SlackMessageAdapterNoBodyParser = proxyquire('../../dist/adapter', { 'body-parser': null }).default;
        this.adapter = new SlackMessageAdapterNoBodyParser(workingVerificationToken);
      });
      it('should reject', function () {
        return this.adapter.createServer()
          .then(function (server) {
            assert.isNotOk(server, 'a server was created');
          })
          .catch(function (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
              assert(true);
            } else {
              throw error;
            }
          });
      });
    });

    it('should return a Promise of an http.Server', function () {
      return this.adapter.createServer().then(function (server) {
        assert.instanceOf(server, http.Server);
      });
    });
  });

  describe('#start()', function () {
    beforeEach(function (done) {
      var self = this;
      self.adapter = new SlackMessageAdapter(workingVerificationToken);
      getRandomPort(function (error, port) {
        if (error) return done(error);
        self.portNumber = port;
        return done();
      });
    });
    afterEach(function () {
      return this.adapter.stop().catch(nop);
    });
    it('should return a Promise for a started http.Server', function () {
      var self = this;
      return this.adapter.start(self.portNumber).then(function (server) {
        // only works in node >= 5.7.0
        // assert(server.listening);
        assert.equal(server.address().port, self.portNumber);
      });
    });
  });

  describe('#stop()', function () {
    beforeEach(function (done) {
      var self = this;
      self.adapter = new SlackMessageAdapter(workingVerificationToken);
      getRandomPort(function (error, port) {
        if (error) return done(error);
        return self.adapter.start(port)
          .then(function (server) {
            self.server = server;
            done();
          })
          .catch(done);
      });
    });
    afterEach(function () {
      return this.adapter.stop().catch(nop);
    });
    it('should return a Promise and the server should be stopped', function () {
      var self = this;
      return this.adapter.stop().then(function () {
        assert(!self.server.listening);
      });
    });
  });

  describe('#expressMiddleware()', function () {
    beforeEach(function () {
      this.adapter = new SlackMessageAdapter(workingVerificationToken);
    });
    it('should return a function', function () {
      var middleware = this.adapter.expressMiddleware();
      assert.isFunction(middleware);
    });
  });

  describe('#action()', function () {
    beforeEach(function () {
      this.adapter = new SlackMessageAdapter(workingVerificationToken);
    });
    it('should fail action registration without handler', function () {
      assert.throws(function () {
        this.adapter.action('my_callback');
      }, TypeError);
    });
    // TODO: see if this can be reused in the options registration
    describe('when registering with a callback_id', function () {
      // TODO: break out actionHandler definition
      it('a plain string callback_id registers successfully', function () {
        var actionHandler = function () { };
        var callbackEntry;

        this.adapter.action('my_callback', actionHandler);

        // TODO: break into a helper that encapsulates knowledge of the internals and can assert
        // that the function was registered
        assert.isNotEmpty(this.adapter.callbacks);
        callbackEntry = this.adapter.callbacks[0];
        assert.equal(callbackEntry[1], actionHandler);
      });
      it('a RegExp callback_id registers successfully', function () {
        var actionHandler = function () { };
        var callbackEntry;

        this.adapter.action(/\w+_callback/, actionHandler);
        assert.isNotEmpty(this.adapter.callbacks);
        callbackEntry = this.adapter.callbacks[0];
        assert.equal(callbackEntry[1], actionHandler);
      });
      it('invalid callback_id types throw on registration', function () {
        var actionHandler = function () { };
        assert.throws(function () {
          this.adapter.action(5, actionHandler);
        }, TypeError);
        assert.throws(function () {
          this.adapter.action(true, actionHandler);
        }, TypeError);
        assert.throws(function () {
          this.adapter.action([], actionHandler);
        }, TypeError);
        assert.throws(function () {
          this.adapter.action(null, actionHandler);
        }, TypeError);
        assert.throws(function () {
          this.adapter.action(undefined, actionHandler);
        }, TypeError);
      });
    });
    // NOTE: the following probably only make sense for actions and not for options
    describe('when registering with a complex set of constraints', function () {
      it('should register with valid type constraints successfully', function () {
        var actionHandler = function () { };
        var callbackEntry;
        var constraints;

        // TODO: see how much shorter this can get with a registration internals assert helper
        constraints = { type: 'button' };
        this.adapter.action(constraints, actionHandler);
        assert.isNotEmpty(this.adapter.callbacks);
        callbackEntry = this.adapter.callbacks[0]; // index changes before each assert
        assert.deepEqual(callbackEntry[0], constraints);
        assert.equal(callbackEntry[1], actionHandler);

        constraints = { type: 'select' };
        this.adapter.action(constraints, actionHandler);
        assert.isNotEmpty(this.adapter.callbacks);
        callbackEntry = this.adapter.callbacks[1]; // index changes before each assert
        assert.deepEqual(callbackEntry[0], constraints);
        assert.equal(callbackEntry[1], actionHandler);

        constraints = { type: 'dialog_submission' };
        this.adapter.action(constraints, actionHandler);
        assert.isNotEmpty(this.adapter.callbacks);
        callbackEntry = this.adapter.callbacks[2]; // index changes before each assert
        assert.deepEqual(callbackEntry[0], constraints);
        assert.equal(callbackEntry[1], actionHandler);
      });
      it('should throw when registering with invalid type constraints', function () {
        var actionHandler = function () { };

        var constraints = { type: 'not_a_real_action_type' };
        assert.throws(function () {
          this.adapter.action(constraints, actionHandler);
        }, TypeError);
      });
      it('should register with valid compound constraints successfully', function () {
        var actionHandler = function () { };
        var callbackEntry;

        var constraints = { callbackId: 'my_callback', type: 'button' };
        this.adapter.action(constraints, actionHandler);
        assert.isNotEmpty(this.adapter.callbacks);
        callbackEntry = this.adapter.callbacks[0];
        assert.deepEqual(callbackEntry[0], constraints);
        assert.equal(callbackEntry[1], actionHandler);
      });
      it('should throw when registering with invalid compound constraints', function () {
        var actionHandler = function () { };

        var constraints = { callbackId: /\w+_callback/, type: 'not_a_real_action_type' };
        assert.throws(function () {
          this.adapter.action(constraints, actionHandler);
        }, TypeError);
      });
      it('should register with unfurl constraint successfully', function () {
        var actionHandler = function () { };
        var callbackEntry;

        var constraints = { unfurl: true };
        this.adapter.action(constraints, actionHandler);
        assert.isNotEmpty(this.adapter.callbacks);
        callbackEntry = this.adapter.callbacks[0];
        assert.deepEqual(callbackEntry[0], constraints);
        assert.equal(callbackEntry[1], actionHandler);
      });
    });
  });

  describe('#options()', function () {
    beforeEach(function () {
      this.adapter = new SlackMessageAdapter(workingVerificationToken);
    });
    it('should fail options registration without handler', function () {
      assert.throws(function () {
        this.adapter.options('my_callback');
      }, TypeError);
    });
  });
});
