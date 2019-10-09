/*
 * Kuzzle, a backend software, self-hostable and ready to use
 * to power modern apps
 *
 * Copyright 2015-2018 Kuzzle
 * mailto: support AT kuzzle.io
 * website: http://kuzzle.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const moment = require('moment');

// Simple progress bar making the wait for long tasks more bearable
class ProgressBar {
  constructor (context, text, total, barSize = 20) {
    this.context = context;
    this.text = text;
    this.total = total;
    this.barSize = barSize;
    this.bar = new context.inquire.ui.BottomBar();
    this.update(0);
    this.start = Date.now();
  }

  destroy () {
    this.bar.updateBottomBar('');
    this.bar.close();
  }

  update (count) {
    const
      elapsed = Date.now() - this.start,
      remainingMs = count ? Math.round(this.total * elapsed / count) : 0,
      remaining = moment(remainingMs).format('mm:ss'),
      str = `${this.text}
${this._getBar(count)}(remaining: ${remaining}) ${count} / ${this.total}`;

    this.bar.updateBottomBar(str);
  }

  _getBar (count) {
    const
      percent = count * 100 / this.total,
      progress = Math.round(percent * this.barSize / 100);

    return '[' + '#'.repeat(progress) + '-'.repeat(this.barSize - progress) + ']';
  }
}

module.exports = ProgressBar;
