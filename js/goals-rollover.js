/**
 * Shared daily-goals rollover (Main + Projects To Do List).
 * At the 6 AM boundary only incomplete tasks move to Today; completed stay on their day.
 */
(function (global) {
  'use strict';

  function goalTextKey(text) {
    return String(text || '').trim().toLowerCase();
  }

  function isGoalDone(g) {
    return !!(g && g.done);
  }

  /**
   * @param {object} api
   * @param {function(): string} api.getActiveDateString
   * @param {function(string): string[]} api.storeListKeys
   * @param {function(string): {items: object[], tombstones: object}} api.getGoalsStore
   * @param {function(string): object[]} api.getGoals
   * @param {function(string, object[]): void} api.setGoals
   * @param {function(string, object): void} api.storeSet
   * @param {function(): string} api.goalUid
   */
  function runRollover(api) {
    var getActiveDateString = api.getActiveDateString;
    var storeListKeys = api.storeListKeys;
    var getGoalsStore = api.getGoalsStore;
    var getGoals = api.getGoals;
    var setGoals = api.setGoals;
    var storeSet = api.storeSet;
    var goalUid = api.goalUid;

    var active = getActiveDateString();
    var activeKey = 'goals:' + active;
    var todayGoals = getGoals(activeKey);
    var keys = storeListKeys('goals:');
    var nowIso = new Date().toISOString();

    // Drop stale incomplete copies when the same day already has that text completed.
    keys.forEach(function (key) {
      var date = key.slice(6);
      if (date >= active) return;
      var pastStore = getGoalsStore(key);
      var visible = pastStore.items.filter(function (g) {
        return !(g && g.id != null && pastStore.tombstones[String(g.id)]);
      });
      var doneTexts = {};
      visible.filter(isGoalDone).forEach(function (g) {
        var tk = goalTextKey(g.text);
        if (tk) doneTexts[tk] = true;
      });
      if (!Object.keys(doneTexts).length) return;

      var tombs = Object.assign({}, pastStore.tombstones || {});
      var changed = false;
      var kept = visible.filter(function (g) {
        if (!g || isGoalDone(g)) return true;
        var tk = goalTextKey(g.text);
        if (tk && doneTexts[tk]) {
          if (g.id != null && g.id !== '') tombs[String(g.id)] = nowIso;
          changed = true;
          return false;
        }
        return true;
      });
      if (changed) storeSet(key, { items: kept, tombstones: tombs });
    });

    keys.forEach(function (key) {
      var date = key.slice(6);
      if (date >= active) return;
      var pastStore = getGoalsStore(key);
      var old = pastStore.items.filter(function (g) {
        return !(g && g.id != null && pastStore.tombstones[String(g.id)]);
      });
      var done = old.filter(isGoalDone);
      var undone = old.filter(function (g) { return !isGoalDone(g); });
      var tombs = Object.assign({}, pastStore.tombstones || {});
      var doneTextKeys = {};
      done.forEach(function (g) {
        var tk = goalTextKey(g.text);
        if (tk) doneTextKeys[tk] = true;
      });

      undone.forEach(function (g) {
        if (!g) return;
        var tk = goalTextKey(g.text);
        if (tk && doneTextKeys[tk]) {
          if (g.id != null && g.id !== '') tombs[String(g.id)] = nowIso;
          return;
        }
        if (g.id != null && g.id !== '') tombs[String(g.id)] = nowIso;

        var text = String(g.text || '').trim();
        var alreadyOpenToday = todayGoals.some(function (t) {
          if (!t || isGoalDone(t)) return false;
          if (t.id && g.id && String(t.id) === String(g.id)) return true;
          return String(t.text || '').trim() === text;
        });
        if (alreadyOpenToday) return;

        todayGoals.push({
          id: goalUid(),
          text: g.text,
          done: false,
          queued: !!g.queued,
          rolledFrom: date,
          time: g.time || undefined,
          cal: g.cal !== false
        });
      });

      storeSet(key, { items: done, tombstones: tombs });
    });

    var completedPastIds = {};
    var completedByDate = {};
    keys.forEach(function (key) {
      var date = key.slice(6);
      if (date >= active) return;
      var byText = completedByDate[date] || (completedByDate[date] = {});
      getGoals(key).forEach(function (g) {
        if (!g || !isGoalDone(g)) return;
        if (g.id != null) completedPastIds[String(g.id)] = true;
        var tk = goalTextKey(g.text);
        if (tk) byText[tk] = true;
      });
    });

    todayGoals = todayGoals.filter(function (t) {
      if (!t || isGoalDone(t)) return true;
      if (t.id != null && completedPastIds[String(t.id)]) return false;
      var tk = goalTextKey(t.text);
      if (!tk) return true;
      if (t.rolledFrom && completedByDate[t.rolledFrom] && completedByDate[t.rolledFrom][tk]) return false;
      var pastDates = Object.keys(completedByDate);
      for (var i = 0; i < pastDates.length; i++) {
        if (completedByDate[pastDates[i]][tk]) return false;
      }
      return true;
    });

    setGoals(activeKey, todayGoals);
  }

  global.JGDash = global.JGDash || {};
  global.JGDash.goalsRollover = {
    runRollover: runRollover,
    goalTextKey: goalTextKey,
    isGoalDone: isGoalDone
  };
})(typeof window !== 'undefined' ? window : global);
