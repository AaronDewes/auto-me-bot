const beforeEach = require('mocha').beforeEach;
const chai = require('chai');
const rewire = require('rewire');
const sinon = require('sinon');

chai.use(require('sinon-chai'));

const autoMeBot = rewire('../src/auto-me-bot');
const expect = chai.expect;

suite('Testing the auto-me-bot export', () => {
    // turn off logs
    console.log = function() { /**/ };

    test('When invoking the application, expect a registration of the events', () => {
        let probotFake = sinon.fake(); // create a fake probot for starting the app
        let probotOnFunctionFake = sinon.fake(); // create a fake "on" function for the probot
        // given the fake probot will adhere the fake 'on' function
        probotFake.on = probotOnFunctionFake;
        // when invoking the application with the fake probot
        autoMeBot(probotFake);
        // then expect the 'on' fake method to be called with the pull request events list
        expect(probotOnFunctionFake).to.be.calledOnceWith(
            autoMeBot.__get__('ON_EVENTS'),
            sinon.match.func
        );
    });

    suite('Test various pull request related configurations', () => {
        let conventionalCommitsHandlerStub;
        let signedCommitsHandlerStub;
        let tasksListHandlerStub;
        let configFuncStub;

        let fakeContext = {};

        let prHandlersControllerSut;

        beforeEach(() => {
            //
            conventionalCommitsHandlerStub = sinon.stub();
            let conventionalCommitsHandlerFake = require('../src/handlers/pr-conventional-commits');
            conventionalCommitsHandlerFake.run = conventionalCommitsHandlerStub;
            //
            signedCommitsHandlerStub = sinon.stub();
            let signedCommitsHandlerFake = require('../src/handlers/pr-signed-commits');
            signedCommitsHandlerFake.run = signedCommitsHandlerStub;
            //
            tasksListHandlerStub = sinon.stub();
            let tasksListHandlerFake = require('../src/handlers/pr-tasks-list');
            tasksListHandlerFake.run = tasksListHandlerStub;
            //
            configFuncStub = sinon.stub();
            // create a fake context for invoking the application with
            fakeContext = {
                payload: {
                    pull_request: {
                        action: 'opened'
                    }
                },
                config: configFuncStub
            };
            // inject handlers stubs
            autoMeBot.__set__({
                prConventionalCommitsHandler: conventionalCommitsHandlerFake,
                prSignedCommitsHandler: signedCommitsHandlerFake,
                prTasksListHandler: tasksListHandlerFake
            });
            // grab the handlersController configured for pr related operations
            prHandlersControllerSut = autoMeBot.__get__('handlersController')(
                autoMeBot.__get__('CONFIG_SPEC')
            );
        })

        test('When all PR operations are checked, execute all PR related handlers', async () => {
            // given the following pr full configuration
            let fullConfig = {pr: { conventionalCommits:{}, signedCommits: {}, tasksList: {} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect all pr related handlers to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, fullConfig.pr.conventionalCommits, sinon.match(t => Date.parse(t))),
                expect(signedCommitsHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, fullConfig.pr.signedCommits, sinon.match(t => Date.parse(t))),
                expect(tasksListHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, fullConfig.pr.tasksList, sinon.match(t => Date.parse(t))),
            ]);
        });

        test('When the conventionalCommits operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let fullConfig = {pr: { conventionalCommits:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(fullConfig);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, fullConfig.pr.conventionalCommits, sinon.match(t => Date.parse(t))),
                expect(signedCommitsHandlerStub).to.have.not.been.called,
                expect(tasksListHandlerStub).to.have.not.been.called,
            ]);
        });

        test('When the signedCommits operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let config = {pr: { signedCommits:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.not.been.called,
                expect(signedCommitsHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, config.pr.signedCommits, sinon.match(t => Date.parse(t))),
                expect(tasksListHandlerStub).to.have.not.been.called,
            ]);
        });

        test('When the tasksList operation is checked, execute the related handler', async () => {
            // given the following pr configuration
            let config = {pr: { tasksList:{} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller
            await prHandlersControllerSut(fakeContext);
            // then expect only the related handler to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.not.been.called,
                expect(signedCommitsHandlerStub).to.have.not.been.called,
                expect(tasksListHandlerStub).to.have.been.calledOnceWith(
                    fakeContext, config.pr.tasksList, sinon.match(t => Date.parse(t))),
            ]);
        });

        [ { pr: {}}, {}, null, { pr: { unknownHandler: {}}}].forEach(config => {
            test(`When no operations are checked and config is ${JSON.stringify(config)}, do not execute any handlers`, async () => {
                // given the current pr configuration
                configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
                // when invoking the controller
                await prHandlersControllerSut(fakeContext);
                // then expect no handlers to be invoked
                return Promise.all([
                    expect(conventionalCommitsHandlerStub).to.have.not.been.called,
                    expect(signedCommitsHandlerStub).to.have.not.been.called,
                    expect(tasksListHandlerStub).to.have.not.been.called,
                ]);
            });
        });

        test('When event payload contains an unsupported event type, do not execute any handlers', async () => {
            // given the current pr configuration
            let config = {pr: { conventionalCommits:{}, signedCommits: {}, tasksList: {} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller with a patched context
            let patchedContext = {
                payload: {
                    unknown_event_type: {
                        action: 'opened'
                    }
                },
                config: configFuncStub
            };
            await prHandlersControllerSut(patchedContext);
            // then expect no handlers to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.not.been.called,
                expect(signedCommitsHandlerStub).to.have.not.been.called,
                expect(tasksListHandlerStub).to.have.not.been.called,
            ]);
        });

        test('When event payload event action type is not supported, do not execute any handlers', async () => {
            // given the current pr configuration
            let config = {pr: { conventionalCommits:{}, signedCommits: {}, tasksList: {} }};
            configFuncStub.withArgs('auto-me-bot.yml').resolves(config);
            // when invoking the controller with a patched context
            let patchedContext = {
                payload: {
                    pull_request: {
                        action: 'closed_shades'
                    }
                },
                config: configFuncStub
            };
            await prHandlersControllerSut(patchedContext);
            // then expect no handlers to be invoked
            return Promise.all([
                expect(conventionalCommitsHandlerStub).to.have.not.been.called,
                expect(signedCommitsHandlerStub).to.have.not.been.called,
                expect(tasksListHandlerStub).to.have.not.been.called,
            ]);
        });
    });
});
