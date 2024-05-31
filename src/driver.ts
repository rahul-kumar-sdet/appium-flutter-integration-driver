import { BaseDriver } from '@appium/base-driver';
import { desiredCapConstraints } from './desiredCaps';
import { JWProxy } from '@appium/base-driver';
import type {
  DefaultCreateSessionResult,
  DriverData,
  W3CDriverCaps,
  DriverCaps,
} from '@appium/types';
type FlutterDriverConstraints = typeof desiredCapConstraints;
import XCUITestDriver from 'appium-xcuitest-driver/build/lib/driver';
import AndroidUiautomator2Driver from 'appium-uiautomator2-driver';
import { createSession } from './session';
import {
  findElOrEls,
  click,
  getText,
  elementDisplayed,
  getAttribute,
  elementEnabled,
  setValue,
  clear,
} from './commands/element';
import { getProxyDriver } from './utils';

const DEFAULT_FLUTTER_SERVER_PORT = 8888;

export class AppiumFlutterDriver extends BaseDriver<FlutterDriverConstraints> {
  // @ts-ignore
  public proxydriver: XCUITestDriver | AndroidUiautomator2Driver;
  public flutterPort: number | null | undefined;
  private internalCaps: DriverCaps<FlutterDriverConstraints> | undefined;
  public proxy: JWProxy | undefined;
  click = click;
  findElOrEls = findElOrEls;
  getText = getText;
  getAttribute = getAttribute;
  elementDisplayed = elementDisplayed;
  elementEnabled = elementEnabled;
  setValue = setValue;
  clear = clear;
  constructor(args: any, shouldValidateCaps: boolean) {
    super(args, shouldValidateCaps);
    this.desiredCapConstraints = desiredCapConstraints;
    this.locatorStrategies = [
      'xpath',
      'css selector',
      'id',
      '-android uiautomator',
      'accessibility id',
      '-ios predicate string',
      '-ios class chain',
      'name',
      'key',
      'class name',
      'semantics label',
      'text',
    ];
  }

  static executeMethodMap = {
    'flutter: waitForAbsent': {
      command: 'waitForElementToBeGone',
      params: {
        required: ['finderType', 'finderValue'],
        optional: ['timeout'],
      },
    },
    'flutter: doubleClick': {
      command: 'doubleClick',
      params: {
        required: ['finder'],
        optional: [],
      },
    },
  };
  async doubleClick(value: any) {
    const elementId = JSON.parse(JSON.stringify(value)).elementId;
    return this.proxy?.command(
      `/session/:sessionId/element/${elementId}/double_click`,
      'POST',
      {},
    );
    //console.log('DoubleTap', value, JSON.parse(JSON.stringify(value)).elementId);
  }

  async waitForElementToBeGone(
    finderType: string,
    finderValue: string,
    timeout: number,
  ) {
    console.log('waitForElementToBeGone', finderType, finderValue, timeout);
  }

  async execute(script: any, args: any) {
    return await this.executeMethod(script, args);
  }

  public async createSession(
    ...args: any[]
  ): Promise<DefaultCreateSessionResult<FlutterDriverConstraints>> {
    const [sessionId, caps] = await super.createSession(
      ...(JSON.parse(JSON.stringify(args)) as [
        W3CDriverCaps,
        W3CDriverCaps,
        W3CDriverCaps,
        DriverData[],
      ]),
    );
    this.internalCaps = caps;
    let sessionCreated = await createSession.call(
      this,
      sessionId,
      caps,
      ...JSON.parse(JSON.stringify(args)),
    );

    if (
      this.proxydriver instanceof XCUITestDriver &&
      !this.proxydriver.isRealDevice()
    ) {
      // @ts-ignore
      this.flutterPort = DEFAULT_FLUTTER_SERVER_PORT;
    }

    // HACK for eliminatin socket hang up by waiting 1 sec
    await new Promise((r) => setTimeout(r, 1000));

    this.proxy = new JWProxy({
      server: '127.0.0.1',
      port: this.flutterPort,
    });
    await this.proxy.command('/session', 'POST', { capabilities: caps });
    return sessionCreated;
  }

  canProxy() {
    return true;
  }

  async deleteSession() {
    if (this.proxydriver instanceof AndroidUiautomator2Driver) {
      // @ts-ignore
      await this.proxydriver.adb.removePortForward(this.flutterPort);
    }
    await this.proxydriver?.deleteSession();
    await super.deleteSession();
  }
}
