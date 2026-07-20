/**
 * 会議シートの作成・レイアウト・セル操作を担当するサービス。
 * Gemini連携やUI表示に関する詳細は他サービスへ委譲する。
 */
var MeetingService = (function () {
  var SHEET_NAME_PREFIX = '会議_';

  var CELL = {
    TITLE_LABEL: 'A1',
    TITLE_VALUE: 'B1',
    START_LABEL: 'A2',
    START_VALUE: 'B2',
    END_LABEL: 'A3',
    END_VALUE: 'B3',
    TRANSCRIPT_LABEL: 'A5',
    TRANSCRIPT_VALUE: 'B5',
    SUMMARY_LABEL: 'A7',
    SUMMARY_VALUE: 'B7',
    NEXT_ACTIONS_LABEL: 'A9',
    NEXT_ACTIONS_VALUE: 'B9',
    STATUS_LABEL: 'A11',
    STATUS_VALUE: 'B11',
  };

  var STATUS = {
    INPUT: '入力中',
    GENERATING: '生成中',
    DONE: '完了',
    ERROR: 'エラー',
  };

  function pad2_(n) {
    return String(n).padStart(2, '0');
  }

  function formatMeetingTimestamp(date) {
    return (
      date.getFullYear() +
      pad2_(date.getMonth() + 1) +
      pad2_(date.getDate()) +
      '_' +
      pad2_(date.getHours()) +
      pad2_(date.getMinutes()) +
      pad2_(date.getSeconds())
    );
  }

  function buildMeetingSheetBaseName(date) {
    return SHEET_NAME_PREFIX + formatMeetingTimestamp(date);
  }

  function resolveUniqueSheetName(baseName, existingNames) {
    if (existingNames.indexOf(baseName) === -1) {
      return baseName;
    }
    var suffix = 2;
    var candidate = baseName + '_' + suffix;
    while (existingNames.indexOf(candidate) !== -1) {
      suffix += 1;
      candidate = baseName + '_' + suffix;
    }
    return candidate;
  }

  function isMeetingSheet_(sheet) {
    return !!sheet && sheet.getName().indexOf(SHEET_NAME_PREFIX) === 0;
  }

  function requireActiveMeetingSheet_() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (!isMeetingSheet_(sheet)) {
      throw new Error(
        '現在のシートは会議シートではありません。「会議を開始」で作成した会議シート上で実行してください。'
      );
    }
    return sheet;
  }

  function layoutMeetingSheet_(sheet, meetingName, startDate) {
    sheet.getRange(CELL.TITLE_LABEL).setValue('会議名');
    sheet.getRange(CELL.TITLE_VALUE).setValue(meetingName);
    sheet.getRange(CELL.START_LABEL).setValue('開始日時');
    sheet.getRange(CELL.START_VALUE).setValue(startDate);
    sheet.getRange(CELL.END_LABEL).setValue('終了日時');
    sheet.getRange(CELL.TRANSCRIPT_LABEL).setValue('文字起こし');
    sheet.getRange(CELL.SUMMARY_LABEL).setValue('会議の要約');
    sheet.getRange(CELL.NEXT_ACTIONS_LABEL).setValue('ネクストアクション');
    sheet.getRange(CELL.STATUS_LABEL).setValue('処理状態');
    sheet.getRange(CELL.STATUS_VALUE).setValue(STATUS.INPUT);

    sheet.getRange('A1:A11').setFontWeight('bold').setBackground('#f1f3f4');
    sheet.setColumnWidth(1, 120);
    sheet.setColumnWidth(2, 520);

    [CELL.TRANSCRIPT_VALUE, CELL.SUMMARY_VALUE, CELL.NEXT_ACTIONS_VALUE].forEach(function (a1) {
      sheet.getRange(a1).setWrap(true).setVerticalAlignment('top');
    });
    sheet.setRowHeight(5, 160);
    sheet.setRowHeight(7, 160);
    sheet.setRowHeight(9, 160);

    sheet
      .getRange('A1:B11')
      .setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
  }

  function startMeeting() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var now = new Date();
    var baseName = buildMeetingSheetBaseName(now);
    var existingNames = ss.getSheets().map(function (s) {
      return s.getName();
    });
    var sheetName = resolveUniqueSheetName(baseName, existingNames);

    var sheet = ss.insertSheet(sheetName, 0);
    layoutMeetingSheet_(sheet, sheetName, now);
    sheet.getRange(CELL.START_VALUE).setValue(now);
    ss.setActiveSheet(sheet);
    sheet.getRange(CELL.TRANSCRIPT_VALUE).activate();

    ss.toast('会議シート「' + sheetName + '」を作成しました。', 'AI議事録', 5);
    return sheetName;
  }

  function appendTranscript(text) {
    var sheet = requireActiveMeetingSheet_();
    var range = sheet.getRange(CELL.TRANSCRIPT_VALUE);
    var current = range.getValue();
    var next = current ? current + '\n' + text : text;
    range.setValue(next);
    return next;
  }

  function getActiveMeetingSheetNameForSidebar() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    return isMeetingSheet_(sheet) ? sheet.getName() : null;
  }

  function generateMinutes() {
    var ui = SpreadsheetApp.getUi();
    var sheet;
    try {
      sheet = requireActiveMeetingSheet_();
    } catch (err) {
      ui.alert(err.message);
      return;
    }

    var transcript = sheet.getRange(CELL.TRANSCRIPT_VALUE).getValue();
    if (!transcript || !String(transcript).trim()) {
      ui.alert('文字起こし（B5）が空です。内容を入力してから実行してください。');
      return;
    }

    if (!PropertyService.hasApiKey()) {
      ui.alert('Gemini APIキーが設定されていません。「APIキーを設定」から登録してください。');
      return;
    }

    var lock = LockService.getDocumentLock();
    var gotLock = lock.tryLock(5000);
    if (!gotLock) {
      ui.alert('別の議事録生成処理が実行中です。しばらくしてから再実行してください。');
      return;
    }

    try {
      sheet.getRange(CELL.STATUS_VALUE).setValue(STATUS.GENERATING);
      SpreadsheetApp.flush();

      var result = LlmService.generateMinutes(String(transcript));

      sheet.getRange(CELL.SUMMARY_VALUE).setValue(result.summary);
      sheet.getRange(CELL.NEXT_ACTIONS_VALUE).setValue(result.nextActionsText);
      sheet.getRange(CELL.STATUS_VALUE).setValue(STATUS.DONE);

      SpreadsheetApp.getActiveSpreadsheet().toast('議事録を生成しました。', 'AI議事録', 5);
    } catch (err) {
      sheet.getRange(CELL.STATUS_VALUE).setValue(STATUS.ERROR);
      console.error('議事録生成に失敗しました: ' + err);
      ui.alert('議事録の生成に失敗しました。' + err.message);
    } finally {
      lock.releaseLock();
    }
  }

  // 実装は feature/finalize-meeting で追加する。
  function endMeeting() {
    SpreadsheetApp.getUi().alert('会議終了機能は準備中です。');
  }

  // 実装は feature/finalize-meeting で追加する。
  function clearMeetingSheet() {
    SpreadsheetApp.getUi().alert('シートクリア機能は準備中です。');
  }

  return {
    startMeeting: startMeeting,
    appendTranscript: appendTranscript,
    getActiveMeetingSheetNameForSidebar: getActiveMeetingSheetNameForSidebar,
    generateMinutes: generateMinutes,
    endMeeting: endMeeting,
    clearMeetingSheet: clearMeetingSheet,
    buildMeetingSheetBaseName: buildMeetingSheetBaseName,
    resolveUniqueSheetName: resolveUniqueSheetName,
    formatMeetingTimestamp: formatMeetingTimestamp,
    CELL: CELL,
    STATUS: STATUS,
    isMeetingSheet_: isMeetingSheet_,
    requireActiveMeetingSheet_: requireActiveMeetingSheet_,
  };
})();

// Node環境（テスト実行時）向けに、純粋関数のみをエクスポートする。
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildMeetingSheetBaseName: MeetingService.buildMeetingSheetBaseName,
    resolveUniqueSheetName: MeetingService.resolveUniqueSheetName,
    formatMeetingTimestamp: MeetingService.formatMeetingTimestamp,
  };
}
