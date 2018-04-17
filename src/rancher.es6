import * as rax from 'retry-axios';
import axios from 'axios';
import assert from 'assert';
import {merge, omit} from 'lodash';
import $url from 'url';

export default class RancherClient {
  constructor({address, version='v1', url, protocol='http', auth, projectId}) {
    if (auth) {
      assert(auth.accessKey, '`auth.accessKey` is missing');
      assert(auth.secretKey, '`auth.secretKey` is missing');
      this._auth = {user: auth.accessKey, password: auth.secretKey};
    }

    if (address && !address.match(/^http/)) {
      address = 'http://' + address;
    }

    if (!url) {
      assert(address, '`url` is missing');
      url = (address.match(/^http/) ? address : protocol + '://' + address);
      if (!url.match(/\/v\d+$/)) {
        url += '/' + version
      }
    }

    this.address = url;
    this.projectId = projectId;

    // Attach rax to axios
    this.interceptorId = rax.attach();
  }

  async getCurrentProjectIdAsync() {
    return (await this._request({
      url: `/v1/projects/`
    })).data[0].id;
  }

  async _request(options) {
    assert(options.url);
    try {
      const res = await axios(merge(options, {
        url: this.buildUrl(options.url),
        headers: this._auth ? {
          'Authorization': 'Basic ' + new Buffer(this._auth.user + ':' + this._auth.password).toString('base64')
        } : {},
        responseType: 'json',
        raxConfig: {
          retry: 3,
          noResponseRetries: 3
        }
      }));

      return res.data
    }
    catch (resp) {
      throw new Error('RancherClientError: non-200 code response on url ' + options.url + ": " + JSON.stringify(resp, null, 4));
    }
  }

  async getServices() {
    return (await this._request({
      url: `projects/${this.projectId}/services`
    })).data;
  }

  async getStacks() {
    return (await this._request({
      url: `projects/${this.projectId}/environments`
    })).data;
  }

  async getService(serviceId) {
    return await this._request({
      url: `projects/${this.projectId}/services/${serviceId}`
    });
  }

  async getCurrentEnvironment() {
    return await this._request({
      url: `projects/${this.projectId}`
    });
  }

  async getStack(stackId) {
    return await this._request({
      url: `projects/${this.projectId}/environments/${stackId}`
    });
  }

  async getServiceContainers(serviceId) {
    return (await this._request({
      url: `projects/${this.projectId}/services/${serviceId}/instances`
    })).data;
  }

  buildUrl(path) {
    if (path.startsWith('/')) {
      return $url.resolve(this.address, path);
    } else {
      return this.address + '/' + path
    }

  }

}
