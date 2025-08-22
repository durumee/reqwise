/**
 * REQRM_ID NUMBER
 * UPPER_REQRM_ID NUMBER
 * REQRM_NM VARCHAR(1000)
 * REQRM_DC VARCHAR(4000)
 * SORT_ORDR NUMBER
 * DEL_AT CHAR(1)
 *
 *
 *
 *
 *
 *
 *
 */
/**
 * ul.date-container > li.date-container-sub-empty > div.day-item-container
 *                                                 > ul.date-container
 *                   > li.date-container-sub       > div.day-item-container-sr
 */
const srms003Resource = {
  apiUrl: 'https://srms-fe.vercel.app/api/',
  getReqrmList: async () => {
    const response = await fetch(`${srms003Resource.apiUrl}reqrms`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  }
};

class EventManager {
  constructor() {
    this.abortController = new AbortController();
  }

  addEventListener(element, event, handler, options = {}) {
    element.addEventListener(event, handler, {
      ...options,
      signal: this.abortController.signal
    });
  }

  cleanup() {
    this.abortController.abort();
    this.abortController = new AbortController();
  }
}

let foldInfo = [];
let submitUpperReqrmId = '';
let submitReqrmId = '';
let reqrmData = '';
let dayItemMap = new Map();  // maybe re-initialization needed for renderList
let searchFirstDepthValue = '';
let dateObserver = null;
let dateTargets = null;
let srSections = [];
let deleteAllSr = [];
let partlyDayItemFrag = {};
let dayItemFrag;
let gStartDate = new Date();
let gEndDate = new Date();
let lastClickTime = 0;
let lastSelectedIndex = -1;
const eventManager = new EventManager();

const detail = async () => {
  await showLoader();

  dayItemMap = new Map();
  initialDate();

  const list = await srms003Resource.getReqrmList();
  renderList(list);
};

const initialDate = (_stDate = new Date(), _edDate, betweenMonth = 1) => {
  gStartDate = new Date(_stDate.getFullYear(), _stDate.getMonth() - betweenMonth, 1, 0, 0, 0, 0);
  gEndDate = new Date(gStartDate);

  if (typeof _edDate != 'undefined') {
    gEndDate.setFullYear(_edDate.getFullYear());
    gEndDate.setMonth(_edDate.getMonth() + betweenMonth);
  } else {
    gEndDate.setMonth(gEndDate.getMonth() + 1 + betweenMonth);
  }

  gEndDate.setDate(new Date(gEndDate.getFullYear(), gEndDate.getMonth() + 1, 0).getDate());  // 마지막 날짜
  gEndDate.setHours(23);
  gEndDate.setMinutes(59);
  gEndDate.setSeconds(59);
  gEndDate.setMilliseconds(999);
}

const parseDateString = (dateString) => {
  if (typeof dateString !== 'string' || dateString.length !== 8) {
    throw new Error('YYYYMMDD 형식의 8자리 문자열이 필요합니다.');
  }
  const year = parseInt(dateString.substring(0, 4), 10);
  const month = parseInt(dateString.substring(4, 6), 10) - 1; // 월은 0부터 시작
  const day = parseInt(dateString.substring(6, 8), 10);

  return new Date(year, month, day);
};

const formatDate = (date, format = 'YYYYMMDD') => {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('ko-KR', options);
  if (format === 'YYYYMMDD') {
    return formatter.format(date).replace(/\./g, '').replace(/ /g, '');
  } else {
    return formatter.format(date);
  }
}

const showLoader = async () => document.getElementById('loader').classList.remove('hide');

const hideLoader = async () => document.getElementById('loader').classList.add('hide');

const updateUpdateReqrmOrder = async (vo) => {
  const list = await srms003Resource.updateReqrmOrder(vo);
  renderList(list);
}

const openReqrmPop = (_reqrmId, _mode) => {
  const el = document.querySelector(`li[data-reqrm-id="${_reqrmId}"`);
  const no = el ? el.querySelector('.content-no').textContent : '';
  const title = el ? el.querySelector('.content-title').textContent : '';
  const description = el ? el.querySelector('.content-description').textContent : '';
  const pop = document.querySelector('#reqrmPop');
  const titleInput = document.querySelector('#reqrmPop .popup-content #titleInput');
  const descInput = document.querySelector('#reqrmPop .popup-content #descInput');

  if (_mode) {
    titleInput.value = title;
    descInput.value = description;
    submitReqrmId = _reqrmId;
  } else {
    submitUpperReqrmId = _reqrmId;
    const popDesc = document.querySelector('#reqrmPop .popup-content .desc');
    if (_reqrmId == 0) {
      popDesc.textContent = `최상위 단계의 새 분류를 추가합니다.`;
    } else {
      popDesc.textContent = `[${no} ${title}] 하위에 새 분류를 추가합니다.`;
    }
  }

  pop.style.display = '';
  titleInput.focus();
}

const closeReqrmPop = () => {
  const pop = document.querySelector('#reqrmPop');
  const titleInput = document.querySelector('#reqrmPop .popup-content #titleInput');
  const descInput = document.querySelector('#reqrmPop .popup-content #descInput');
  pop.style.display = 'none';
  titleInput.value = '';
  descInput.value = '';
  submitUpperReqrmId = '';
}

const saveReqrm = async () => {
  const titleInput = document.querySelector('#reqrmPop .popup-content #titleInput');
  const descInput = document.querySelector('#reqrmPop .popup-content #descInput');

  if (submitUpperReqrmId != '') {
    const reqrmVo = {
      upperReqrmId: submitUpperReqrmId,
      reqrmNm: titleInput.value.replace(/\r\n|\n|\r/g, ''),
      reqrmDc: descInput.value,
    };

    srms003Resource.saveReqrm(reqrmVo).then(_reqrmId => {
      if (reqrmVo.upperReqrmId == 0) {
        localStorage.setItem('srms003.search.value', _reqrmId);
        location.reload();
      } else {
        reqrmVo.reqrmId = parseInt(_reqrmId);
        reqrmVo.upperReqrmId = parseInt(reqrmVo.upperReqrmId);
        const listIndex = document.querySelector('#firstDepthList').selectedIndex;
        const appendedNode = appendNodeByUpperReqrmId(reqrmData[listIndex], reqrmVo);
        reqrmVo.sortOrdr = parseInt(appendedNode.sortOrdr);
  
        const toggleBox = document.querySelector(`li.toggle-box[data-reqrm-id="${reqrmVo.upperReqrmId}"]`);
        let frag1 = toggleBox.querySelector('ul.hierachy-list');
        let frag2 = document.querySelector(`ul.status-container-sub-empty[data-reqrm-id="${reqrmVo.upperReqrmId}"] > ul.status-container`);
        let frag3 = document.querySelector(`ul.date-container-sub-empty[data-reqrm-id="${reqrmVo.upperReqrmId}"] > ul.date-container`);

        if (!frag1) {
          frag1 = document.createElement('ul');
          frag1.className = 'hierachy-list';
          toggleBox.appendChild(frag1);
        }

        if (!frag2) {
          const target = document.querySelector(`ul.status-container-sub-empty[data-reqrm-id="${reqrmVo.upperReqrmId}"]`);
          frag2 = document.createElement('ul');
          frag2.className = 'status-container';
          target.appendChild(frag2);
        }

        if (!frag3) {
          const target = document.querySelector(`ul.date-container-sub-empty[data-reqrm-id="${reqrmVo.upperReqrmId}"]`);
          frag3 = document.createElement('ul');
          frag3.className = 'date-container';
          target.appendChild(frag3);
        }

        renderItemTree(new Array(reqrmVo), frag1, frag2, frag3, parseInt(toggleBox.dataset.depth) + 1, reqrmVo.upperReqrmId);
        applyObservation();
      }
    });
  } else {
    const reqrmVo = {
      reqrmId: submitReqrmId,
      reqrmNm: titleInput.value.replace(/\r\n|\n|\r/g, ''),
      reqrmDc: descInput.value,
    };

    srms003Resource.updateReqrm(reqrmVo).then(() => {
      document.querySelector(`li.toggle-box[data-reqrm-id="${reqrmVo.reqrmId}"] div.content-title`).textContent = reqrmVo.reqrmNm;
      document.querySelector(`li.toggle-box[data-reqrm-id="${reqrmVo.reqrmId}"] div.content-description`).textContent = reqrmVo.reqrmDc;
    });
  }

  titleInput.value = '';
  descInput.value = '';
  submitReqrmId = '';
  submitUpperReqrmId = '';
  closeReqrmPop();
}

const cleanReqrmElement = (target) => {
  // target: div.date-container-sub
  dateObserver.unobserve(target.querySelector('div.item-container-sub1'));

  if (target.parentElement && target.parentElement.childElementCount > 0) {
    document.querySelector(`li.date-container-sub-empty[data-reqrm-id="${target.dataset.reqrmId}"]`)?.remove();
    document.querySelector(`li.status-container-sub-empty[data-reqrm-id="${target.dataset.reqrmId}"]`)?.remove();
    document.querySelector(`li.date-container-sub[data-reqrm-id="${target.dataset.reqrmId}"]`)?.remove();
    document.querySelector(`li.status-container-sub[data-reqrm-id="${target.dataset.reqrmId}"]`)?.remove();
    target.remove();  // div.item-container
  } else {//자식 요소 1개 이상 조건이 if에 있기 때문에 이 else 부분은 데드코드일 가능성이 높음
    //  부모 ul 요소가 더 이상 자식을 가지지 않으면 부모 요소 자체를 제거 필요
    document.querySelector(`li.date-container-sub-empty[data-reqrm-id="${target.dataset.reqrmId}"]`)?.parentElement.remove();
    document.querySelector(`li.status-container-sub-empty[data-reqrm-id="${target.dataset.reqrmId}"]`)?.parentElement.remove();
    target.parentElement.remove();
  }
}

const deleteReqrm = async (e) => {
  const target = e.target.closest('li');
  const _reqrmId = target.dataset.reqrmId;
  const _upperReqrmId = target.dataset.upperReqrmId;
  const dlg = dialogs.confirm('확인', '이 항목 및 하위의 모든 항목이 삭제됩니다. 계속할까요?');
  dlg.result.then(async (btn) => {
    if (btn == 'yes') {
      const reqrmVo = {
        reqrmId: _reqrmId,
      };

      srms003Resource.deleteReqrm(reqrmVo).then(list => {
        if (_upperReqrmId == 0) {
          localStorage.setItem('srms003.search.value', _reqrmId);
          location.reload();
        } else {
          cleanReqrmElement(target);
        }
      });
    }
  });
}

const refreshFirstDepthList = () => {
  const list = document.querySelector('#firstDepthList');
  let newOptions = '';
  const searchValue = localStorage.getItem('srms003.search.value');
  const selectedIndex = reqrmData.findIndex(item => item.reqrmId == searchValue);

  reqrmData.forEach(data => {
    newOptions += `<option value="${data.reqrmId}">${data.reqrmNm}</option>`;
  });

  newOptions += `<option value="0">전체</option>`;
  list.innerHTML = newOptions;

  if (searchValue == 0) {
    selectedIndex = list.length - 1;
  } else {
    selectedIndex = selectedIndex == -1 ? 0 : selectedIndex;
  }

  list.selectedIndex = selectedIndex;
}

const restoreFoldInfo = () => {
  if (!localStorage.foldArr) {
    localStorage.foldArr = JSON.stringify([]);
  } else {
    foldInfo = JSON.parse(localStorage.foldArr);
  }

  foldInfo.forEach(reqrmId => {
    const btnFold = document.querySelector(`div[data-reqrm-id="${reqrmId}"][data-open]`);

    if (btnFold) {
      const isOpen = btnFold.dataset.open === 'true';
      btnFold.dataset.open = (!isOpen).toString();

      if (isOpen) {
        btnFold.classList.add('btn-unfold');
        btnFold.classList.remove('btn-fold');
      } else {
        btnFold.classList.remove('btn-unfold');
        btnFold.classList.add('btn-fold');
      }
    }

    toggleFold(reqrmId, true);
  });
}

const renderList = async (list) => {
  const frag1 = document.createDocumentFragment();
  const frag2 = document.createDocumentFragment();
  const frag3 = document.createDocumentFragment();
  const srSection1 = document.querySelector('.sr-section-1');
  const srSection2 = document.querySelector('.sr-section-2');
  const srSection3 = document.querySelector('.sr-section-3');

  eventManager.cleanup();
  reqrmData = convertRowToJson(list);
  refreshFirstDepthList();
  createDateHeaderFrag();
  searchFirstDepthValue = document.querySelector('#firstDepthList').value;

  if (searchFirstDepthValue == '0') {
    renderItemTree(reqrmData, frag1, frag2, frag3);
  } else {
    const listIndex = reqrmData.findIndex(el => el.reqrmId == searchFirstDepthValue);
    if (listIndex > -1) {
      renderItemTree(new Array(reqrmData[listIndex]), frag1, frag2, frag3);
    }
  }

  srSection1.appendChild(frag1);
  srSection2.appendChild(frag2);
  srSection3.appendChild(frag3);

  applyStylingAndInteractivity();
  applyObservation();
  restoreFoldInfo();

  setTimeout(() => {
    hideLoader();
    getSrSection();
    moveToToday();
  }, 100)
}

const highlightElement = () => {
  const srNo = localStorage.getItem('srms003.offset.srNo');
  const target = document.querySelector(`sr-data[data-sr-no='${srNo}']`);
  if (!target) return;

  const overlay = document.querySelector('#highlight-overlay');
  const rect = target.getBoundingRect();
  const scrollX = window.pageXOffset || document.documentElement.scrollLet;
  const scrollY = window.pageYOffset || document.documentElement.scrollTop;

  localStorage.removeItem('srms003.offset.srNo');

  overlay.style.top = `${rect.top + scrollY}px`;
  overlay.style.left = `${rect.left + scrollX}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.opacity = '1';

  setTimeout(() => {
    overlay.style.opacity = '0';
  }, 2000);
}

const moveToToday = () => {
  let offsetDate = localStorage.getItem(`srms003.offset.date`);
  const offsetTop = localStorage.getItem(`srms003.offset.top`);
  localStorage.removeItem(`srms003.offset.date`);
  localStorage.removeItem(`srms003.offset.top`);

  if (!offsetDate) {
    const today = new Date();
    offsetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  }

  if (offsetTop) {
    setTimeout(() => {
      document.querySelector('.sr-selection-wrapper2').scrollTop = offsetTop - 400;
      applyObservation();
      setTimeout(() => {
        highlightElement();
      }, 10);
    }, 0);
  }

  const offsetLeftEl = document.querySelector(`td[data-date='${offsetDate}']`);
  if (offsetLeftEl) {
    setTimeout(() => {
      document.querySelector('.header-section-3').scrollLeft = offsetLeftEl.offsetLeft;
    }, 1000);
  } else {
    showLoader();
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      const offsetTop = document.querySelector('div.sr-section-wrapper1').scrollTop;
      const today = new Date();
      localStorage.setItem('srms003.offset.top', offsetTop);
      localStorage.setItem('srms003.offset.date', new Date(today.getFullYear(), today.getMonth(), today.getDate().getTime());
      initialDate();

      await renderDayItems();
    } finally {
      hideLoader();
      moveToToday();
    }
  }
}

const getSrSection = () => {
  srSections = [];
  const srSecs = document.querySelectorAll('div.btn-uncomplete, div.btn-complete');

  srSecs.forEach((srSec, i) => {
    if (srSec.offsetTop > 0) {
      // when element hide then offset is 0
      srSections.push(srSec.offsetTop - 240);
    }
  });
}

const scrollToSrSection = (direction) => {
  if (srSections.length > 0) {
    const currScrollTop = document.querySelector('div.sr-section-wrapper1').scrollTop;
    let newOffset;

    if (direction == 'next') {
      const findNextOffset = srSections.find(item => item > currScrollTop);

      if (findNextOffset) {
        newOffset = findNextOffset;
      } else {
        newOffset = srSections[0];
      }
    } else {
      // 후순위(b) 와의 차이를 통해 내림차순 정렬하여 검색
      const findPrevOffset = srSections.slice().sort((a, b) => b - a).find(item => item < currScrollTop);

      if (findPrevOffset) {
        newOffset = findPrevOffset
      } else {
        newOffset = srSections[srSections.length - 1];
      }
    }

    document.querySelector('.sr-section-wrapper2').scrollTop = newOffset;
  } else {
    alert('No sr present');
  }
}

const _filterSrInput = () => {
  const filterSr = document.querySelector('#filterSr');
  const selectSr = document.querySelector('#selectSr');
  const keyword = filterSr.value.toLowerCase();
  selectSr.innerHTML = '';

  list.forEach(el => {
    const text = `${el.srNo} | ${el.srmsTitle}`;
    if (text.toLowerCase().includes(keyword)) {
      const option = document.createElement('option');
      option.value = el.reqSeq;
      option.innerText = text;
      selectSr.appendChild(option);
    }
  });

  setTimeout(() => {
    const currLen = document.querySelectorAll('#selectSr option').length;
    document.querySelector('label[for="selectSr"]').textContent = '미지정 SR 목록 (' + Intl.NumberFormat('ko-KR').format(currLen) + '건)';
  }, 300);
}

const replaceSrItems = (rltSrList, reqrmId) => {
  /**
   * item-container-sub2 가 없으면, appendChild to "li.toggle-box > div.item-container"
   * sub2 에는 div.sr-list > div.sr-data 생성, data-sr-no, data-req-seq, data-srms-status-nm, data-proc-st-due-de, data-proc-comp-due-de 추가
   */
  let sub2 = document.querySelector(`div.item-container-sub2[data-reqrm-id="${reqrmId}"]`);  // div.sr-list 단위로 추가

  if (!sub) {
    sub2 = document.createElement('div');
    sub2.className = 'item-container-sub2';
    sub2.dataset.reqrmId = reqrmId;

    document.querySelector(`li.toggle-box[data-reqrm-id="${reqrmId}"] > .item-container`).appendChild(sub2);
  } else {
    sub2.querySelectorAll('.sr-data').forEach(el => dateObserver.unobserve(el));
    sub2.innerHTML = '';
  }

  const srList = document.createElement('div');
  srList.className = 'sr-list';
  sub2.appendChild(srList);

  const tmpSrDatas = document.createDocumentFragment();
  rltSrList.forEach(sr => tmpSrDatas.appendChild(createSrData(sr, reqrmId)));
  srList.appendChild(tmpSrDatas);

  /**
   * li.status-container-sub 존재하면 sr-status-item 모두 삭제하고 새로 생성해서 append
   * li.status-container-sub-empty 존재하면 div.sr-status-item-empty 를 sr-status-item 으로 변경
   * li.status-container-pad 및 div.sr-status-item
   */
  const status = document.querySelector(`li.status-container-sub[data-reqrm-id="${reqrmId}"]`);
  const statusEmpty = document.querySelector(`li.staus-container-sub-empty[data-reqrm-id="${reqrmId}"]`);
  const tmpStatusList = document.createDocumentFragment();
  rltSrList.forEach(sr => tmpStatusList.appendChild(createSrStatusItem(sr, reqrmId)));

  if (status) {
    status.querySelectorAll('.sr-status-item').forEach(el => el.remove());
    status.appendChild(tmpStatusList);
  } else {
    statusEmpty.className = 'status-container-sub';
    statusEmpty.querySelector('div.sr-status-item-empty').remove();
    statusEmpty.appendChild(createStatusContainerPad(statusEmpty.dataset.upperReqrmId, statusEmpty.dataset.reqrmId));
    statusEmpty.appendChild(tmpStatusList);
  }

  // li.date
  const date = document.querySelector(`li.date-container-sub[data-reqrm-id="${reqrmId}"]`);
  const dateEmpty = document.querySelector(`li.date-container-sub-empty[data-reqrm-id="${reqrmId}"]`);

  if (date) {  // > div.date-container-pad > div.day-item-container > div.day-item
    date.querySelectorAll('.day-item-container-sr').forEach(el => el.remove());
    rltSrList.forEach(sr => {
      const tmpSr = createDayItemContainerSr(sr);
      dateObserver.observe(tmpSr);
      date.appendChild(tmpSr);
    });
  } else if (dateEmpty) {  // > div.day-item-container > div.day-item
    dateEmpty.className = 'date-container-sub';
    rltSrList.forEach(sr => {
      const tmpSr = createDayItemContainerSr(sr);
      dateObserver.observe(tmpSr);
      dateEmpty.appendChild(tmpSr);
    });
  }

  applyObservation();
}

const saveSr = async () => {
  const options = document.querySelector('#selectSr').options;
  let reqrmVoArr = new Array();

  for (let el of options) {
    if (el.selected) {
      const reqrmVo = {
        reqrmId: submitReqrmId,
        reqSeq: el.value,
      };

      reqrmVoArr.push(reqrmVo);
    }
  }

  srms003Resource.saveReqrmRlt(reqrmVoArr).then(() => {
    srms003Resource.getRltSrList(reqrmVoArr[0]).then(rltSrList => {
      replaceSrItems(rltSrList, reqrmVoArr[0].reqrmId);
    });
  });

  closeSrPop();
};

const _selectSrClick = async () => {
  const selectSr = document.querySelector('#selectSr');
  const now = Date.now();
  const selectedIndex = selectSr.selectedIndex;
  if (selectedIndex < 0) return;

  if (selectedIndex === lastSelectedIndex && now - lastClickTime < 200) {
    let reqrmVoArr = new Array();
    const reqrmVo = {
      reqrmId: submitReqrmId,
      reqSeq: selectSr.options[selectedIndex].value,
    };
    reqrmVoArr.push(reqrmVo);
    srms003Resource.saveReqrmRlt(reqrmVoArr).then(() => {
      srms003Resource.getRltSrList(reqrmVoArr[0]).then(rltSrList => {
        replaceSrItems(rltSrList, reqrmVoArr[0].reqrmId);
      });
    });
    closeSrPop();
  }

  lastClickTime = now;
  lastSelectedIndex = selectedIndex;
}

const openSrPop = (reqrmId) => {
  const offsetTop = document.querySelector(`.hierachy-list li[data-reqrm-id="${reqrmId}"]`).offsetTop;
  localStorage.setItem('srms003.offset.top', offsetTop);
  submitReqrmId = reqrmId;
  const tmpNo = document.querySelector(`li[data-reqrm-id="${reqrmId}"] .content-no`).textContent;
  const tmpTitle = document.querySelector(`li[data-reqrm-id="${reqrmId}"] .content-title`).textContent;
  document.querySelector('#srPop .desc').textContent = `${tmpNo} ${tmpTitle}`;

  srms003Resource.getSrList().then((list) => {
    const filterSr = document.querySelector('#filterSr');
    const selectSr = document.querySelector('#selectSr');
    filterSr.value = '';
    filterSr.focus();
    filterSr.addEventListener('input', _filterSrInput);
    selectSr.addEventListener('click', _selectSrClick);

    list.forEach(el => {
      const option = document.createElement('option');
      option.value = el.reqSeq;
      option.innerText = `${el.srNo} | ${el.srmsTitle}`;
      selectSr.appendChild(option);
    });

    document.querySelector('label[for="selectSr"]').textContent = '미지정 SR 목록 (' + Intl.NumberFormat('ko-KR').format(currLen) + '건)';
  });

  document.querySelector('#srPop').style.display = '';
}

const closeSrPop = () => {
  setTimeout(() => {
    localStorage.removeItem('srms003.offset.top');
  }, 300);
  submitReqrmId = '';
  document.querySelector('#selectSr').innerHTML = '';
  document.querySelector('#filterSr').removeEventListener('click', _filterSrInput);
  document.querySelector('#srPop').style.display = 'none';
};

const convertRowToJson = (rows) => {
  const nodesMap = {};
  const rootNode = [];

  rows.forEach(row => nodesMap[row.reqrmId] = createNode(row));

  rows.forEach(row => {
    const currentNode = nodesMap[row.reqrmId];

    if (row.upperReqrmId > 0) {
      const upperNode = nodesMap[row.upperReqrmId];
      if (upperNode) {
        upperNode.children.push(currentNode);
      }
    } else {
      rootNode.push(currentNode);
    }
  });

  return rootNode;
}

const hasChildren = (item) => {
  return item.children?.length > 0 && Array.isArray(item.children);
}

const createNode = (row) => {
  return {
    reqrmId: row.reqrmId,
    upperReqrmId: row.upperReqrmId,
    reqrmNm: row.reqrmNm,
    reqrmDc: row.reqrmDc,
    sortOrdr: row.sortOrdr,
    rltSrCnt: row.rltSrCnt ? row.rltSrCnt : '',
    rltSrList: row.rltSrList ? row.rltSrList : '',
    children: []
  }
}

const appendNodeByUpperReqrmId = (data, newRow) => {
  if (data.reqrmId === newRow.upperReqrmId) {
    let appendRow = createNode(newRow);
    appendRow.sortOrdr = data.children.length + 1;
    data.children.push(appendRow);
    return appendRow;
  } else {
    if (data.children && Array.isArray(data.children)) {
      for (const child of data.children) {
        const found = appendNodeByUpperReqrmId(child, newRow);
        if (found) {
          return found;
        }
      }
    }
  }
}

const createIcon = (iconText) => {
  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined';
  icon.style.cursor = 'pointer';
  icon.textContent = iconText;
  return icon;
}

let totalHolidayIndex = { saturday: [], holiday: [] };
let totalDayIndex = [];
let dateHeaderFrag;

const createDateHeaderFrag = () => {
  const startYear = 2021;
  const startMonth = 1;
  const endYear = new Date().getFullYear();
  const endMonth = 12;

  const week = ['일', '월', '화 ', '수', '목', '금', '토'];
  const table = document.getElementById('dateTable');
  table.innerHTML = '';
  dateHeaderFrag = document.createDocumentFragment();
  const monthRow = document.createElement('tr');
  const dayRow = document.createElement('tr');
  totalHolidayIndex.saturday = [];
  totalHolidayIndex.holiday = [];
  totalDayIndex = [];

  for (let year = startYear; year <= endYear; year++) {
    for (let month = startMonth; month <= endMonth; month++) {
      const lastDay = new Date(year, month, 0).getDate();
      const monthCell = document.createElement('td');
      monthCell.colSpan = lastDay;
      monthCell.dataset.date = new Date(year, month - 1, 1).getTime();
      monthCell.textContent = `${year}. ${month}.`;
      monthRow.appendChild(monthCell);

      for (let day = 1; day <= lastDay; day++) {
        const currIdx = totalDayIndex.length;
        const date = new Date(year, month - 1, day);
        const dayCell = document.createElement('td');
        dayCell.dataset.date = date.getTime();
        dayCell.textContent = `${date.getDate()}\n${week[date.getDay()]}`;
        if (date.getDay() == 6) {
          dayCell.style.color = '#1976d2';
          dayCell.style.backgroundColor = '#efefef';
          totalHolidayIndex.saturday.push(currIdx);
        } else if (date.getDay() == 0) {
          dayCell.style.color = '#d32f2f';
          dayCell.style.backgroundColor = '#efefef';
          totalHolidayIndex.holiday.push(currIdx);
        }
        dayRow.appendChild(dayCell);

        const ymdDate = `${year}${(month + '').padStart(2, '0')}${(day + '').padStart(2, '0')}`;
        totalDayIndex.push({ date: ymdDate, index: currIdx });
      }
    }
  }

  dateHeaderFrag.appendChild(monthRow);
  dateHeaderFrag.appendChild(dayRow);

  table.appendChild(createPartlyDateHeaderFrag());
  createDayItemFragment();
  createPartlyDayItemFragment();
}

const createPartlyDateHeaderFrag = () => {
  const copiedHeaderFrag = dateHeaderFrag.cloneNode(true);
  const filteredMonthCells = Array.from(copiedHeaderFrag.querySelectorAll('td[colspan]')).filter(e => e.dataset.date >= gStartDate.getTime() && e.dataset.date <= gEndDate.getTime());
  const filteredDayCells = Array.from(copiedHeaderFrag.querySelectorAll('td:not([colspan])[data-date]')).filter(e => e.dataset.date >= gStartDate.getTime() && e.dataset.date <= gEndDate.getTime());
  const renderTableFrag = document.createDocumentFragment();
  const filteredMonthRow = document.createElement('tr');
  const filteredDayRow = document.createElement('tr');
  filteredMonthCells.forEach(el => filteredMonthRow.appendChild(el));
  filteredDayCells.forEach(el => filteredDayRow.appendChild(el));
  renderTableFrag.appendChild(filteredMonthRow);
  renderTableFrag.appendChild(filteredDayRow);

  return renderTableFrag;
}

// 날짜 가로 스크롤에 따라 기준 HTML 생성
const createDayItemFragment = () => {
  dayItemFrag = document.createDocumentFragment();

  for (let i = 0; i < totalDayIndex.length; ++i) {
    const dayItem = document.createElement('div');
    dayItem.className = 'day-item';
    dayItem.dataset.index = totalDayIndex[i].index;
    dayItem.dataset.date = totalDayIndex[i].date;

    // 토요일/공휴일 마킹
    if (totalHolidayIndex.saturday.includes(i) || totalHolidayIndex.holiday.includes(i)) {
      dayItem.classList.add('holiday');
    }

    dayItemFrag.appendChild(dayItem);
  }
}

// 전체 날짜의 프래그먼트에서 표시할 대상만 추출하여 새 프래그먼트로 저장해둔다
const createPartlyDayItemFragment = () => {
  const dayFrag = dayItemFrag.cloneNode(true);
  const filteredCells = Array.from(dayFrag.querySelectorAll('div')).filter(e => e.dataset.date >= formatDate(gStartDate) && e.dataset.date <= formatDate(gEndDate));
  const renderFrag = document.createDocumentFragment();
  filteredCells.forEach(el => renderFrag.appendChild(el));

  partlyDayItemFrag = renderFrag;
}

// 날짜:인덱스, SR의 시작종료일자 존재
// {일자: 진척률} 데이터 전달
const updateDayItemMap = (srData) => {
  const dayFrag = partlyDayItemFrag.cloneNode(true); console.log('renEachDayItem', dayFrag);
  const dailyProcRate = [];
  let stCompDueIndex = { 'st': -1, 'comp': -1 };

  // 특정일자의 진척률 표기를 위한 데이터
  if (srData?.procRates) {
    const procs = srData.procRates.split('|');
    procs.forEach(proc => {
      const info = proc.split(',');
      const index = totalDayIndex.find(obj => obj.date === info[0]);
      dailyProcRate.push({ 'index': index?.index, 'date': info[0], 'rate': info[1] });
    });
  }
  // 진척률이 존재하는 날을 마킹
  dailyProcRate.forEach(obj => {
    const el = dayFrag.querySelector(`[data-date="${obj.date}"]`);
    if (el) {
      el.classList.add('procday');
      el.textContent = obj.rate + '%';
    }
  });
  // 시작/완료 예정일 인덱스 구축
  if (srData?.procStDueDe || srData?.procCompDueDe) {
    const stIndex = totalDayIndex.find(obj => obj.date === srData?.procStDueDe);
    const compIndex = totalDayIndex.find(obj => obj.date === srData?.procCompDueDe);
    let stDueIdx;
    let compDueIdx;
    if (stIndex) stDueIdx = stIndex.index;
    compDueIdx = compIndex ? compIndex.index : stDueIdx;
    stCompDueIndex = { 'st': stDueIdx, 'comp': compDueIdx };
  }

  // 시작/완료 예정일을 마킹
  for (let i = stCompDueIndex.st; i < stCompDueIndex.comp; ++i) {
    dayFrag.querySelector(`[data-index="${i}"]`)?.classList.add('procday');
  }

  if (typeof srData !== 'undefined' && typeof srData.srNo !== 'undefined') {
    dayItemMap.set(srData.srNo, dayFrag);
  }
}

// 카운트를 세고 -> 카운트 만큼 돌면서 해당 오브젝트를 재귀적으로 탑색해야 한다
const renderDayItemByChild = async (tmpObj) => {
  if (Array.isArray(tmpObj)) {
    console.log('renderDayItemByChild array');
    for (const o of tmpObj) {
      renderDayItemByChild(o);
    }
  } else {
    let dayItemContainers = document.querySelector(`li.date-container-sub-empty[data-reqrm-id="${tmpObj.reqrmId}"] > .day-item-container`);
    const rltSrCnt = tmpObj.rltSrCnt;

    if (rltSrCnt == 0) {
      dayItemContainers.innerHTML = '';
    } else {
      dayItemContainers = document.querySelector(`li.date-container-sub[data-reqrm-id="${tmpObj.reqrmId}"] > .date-container-pad > .day-item-container`);
      dayItemContainers.innerHTML = '';

      for (let srCnt = 0; srCnt < rltSrCnt; ++srCnt) {
        const tmpSrInfo = tmpObj.rltSrList[srCnt];
        const tmpSrEl = document.querySelector(`.day-item-container-sr[data-sr-no="${tmpSrInfo.srNo}"]`);
        tmpSrEl.innerHTML = '';
        const srData = {
          procRates: tmpSrInfo.procRates,
          procStDueDe: tmpSrInfo.procStDueDe ? tmpSrInfo.procSrDueDe : '',
          procCompDueDe: tmpSrInfo.procCompDueDe ? tmpSrInfo.procCompDueDe : '',
        };

        updateDayItemMap(srData);
      }
    }

    if (tmpObj.children) {
      renderDayItemByChild(tmpObj.children, dayItemContainers);
    }
  }
}

const renderDayItems = async () => {
  const table = document.getElementById('dateTable');
  table.innerHTML = '';
  table.appendChild(createPartlyDateHeaderFrag());

  createPartlyDayItemFragment();
  let tmpObj = reqrmData;

  if (searchFirstDepthValue != 0) {
    const listIndex = reqrmData.findIndex(el => el.reqrmId == searchFirstDepthValue);
    tmpObj = reqrmData[listIndex];
  }

  renderDayItemByChild(tmpObj);
  relaodTdColSpan();
}

const createStatusContainerPad = (upperReqrmId, reqrmId) => {
  const statusContainerPad = document.createElement('li');
  statusContainerPad.className = 'status-container-pad';
  statusContainerPad.dataset.upperReqrmId = upperReqrmId;

  const btnUncomplete = document.createElement('div');
  btnUncomplete.className = 'btn-uncomplete';
  btnUncomplete.textContent = '진행';
  btnUncomplete.dataset.reqrmId = item.reqrmId;
  statusContainerPad.appendChild(btnUncomplete);

  return statusContainerPad;
}

const createDayItemContainer = (reqrmId) => {
  const dayItemContainer = document.createElement('div');
  dayItemContainer.className = 'day-item-container';
  dayItemContainer.dataset.reqrmId = reqrmId;

  return dayItemContainer;
}

const createSrData = (data, reqrmId) => {
  const srData = document.createElement('div');
  srData.className = 'sr-data';
  srData.dataset.srNo = data.srNo;
  srData.dataset.reqSeq = data.reqSeq;
  srData.dataset.srmsStatusNm = data.srmsStatusNm;
  srData.dataset.procStDueDe = data.procStDueDe;
  srData.dataset.procCompDueDe = typeof data.procCompDueDe == 'undefined' ? '' : data.procCompDueDe;

  const srDataChk = document.createElement('div');
  srDataChk.className = 'sr-data-check';

  const lblChk = document.createElement('label');
  lblChk.className = 'sr-check';
  const inputChk = document.createElement('input');
  inputChk.className = 'sr-check-input';
  inputChk.type = 'checkbox';
  inputChk.dataset.reqSeq = data.reqSeq;
  inputChk.dataset.parentReqrmId = reqrmId;
  const divChk = document.createElement('div');
  divChk.className = 'sr-checkbox';
  lblChk.appendChild(inputChk);
  lblChk.appendChild(divChk);
  srDataChk.appendChild(lblChk);
  const srDeleteAll = document.createElement('div');
  srDeleteAll.className = 'sr-btn-delete-all hide';
  srDeleteAll.appendChild(createIcon('delete'));
  srDeleteAll.dataset.parentReqrmId = reqrmId;
  srDataChk.appendChild(srDeleteAll);

  const srInfo = document.createElement('div');
  srInfo.className = 'sr-data-info';
  const srNo = document.createElement('span');
  const formattedSrNo = data.srNo.replace(/^([A-Z]{2})(\d{4})(\d{4})$/, '$1$2$3');
  srNo.className = 'sr-data-no';
  srNo.textContent = formattedSrNo;
  srInfo.appendChild(srNo);

  const srTitle = document.createElement('span');
  srTitle.className = 'sr-data-title';
  let stDue = '미정';
  let compDue = '미정';
  if (data.procStDueDe) stDue = formatDate(parseDateString(data.procStDueDe), 'YYYY.MM.DD.');
  if (data.procCompDueDe) compDue = formatDate(parseDateString(data.procCompDueDe), 'YYYY.MM.DD.');

  srTitle.textContent = ' ' + data.srmsTitle + ' (' + stDue + ' ~ ' + compDue + ')';
  srInfo.appendChild(srTitle);
  srData.appendChild(srDataChk);
  srData.appendChild(srInfo);

  const srDelete = document.createElement('div');
  srDelete.className = 'sr-btn-delete';
  srDelete.appendChild(createIcon('delete'));
  srData.appendChild(srDelete);

  const srLink = document.createElement('div');
  srLink.className = 'sr-btn-link';

  const srLink1 = document.createElement('div');
  srLink1.className = 'sr-btn-link1';
  srLink1.appendChild(createIcon('link'));
  const srLink2 = document.createElement('div');
  srLink2.className = 'sr-btn-link2';
  srLink2.appendChild(createIcon('link'));
  srLink.appendChild(srLink1);
  srLink.appendChild(srLink2);
  srData.appendChild(srLink);

  const srDateView = document.createElement('div');
  srDateView.className = 'sr-btn-date';
  srDateView.appendChild(createIcon('calendar_month'));
  srData.appendChild(srDateView);

  return srData;
}

const createSrStatusItem = (data, reqrmId) => {
  const statusItem = document.createElement('div');
  statusItem.className = 'sr-status-item'
  statusItem.dataset.reqrmId = reqrmId;
  statusItem.dataset.srNo = data.srNo;
  statusItem.dataset.srmsStatusNm = data.srmsStatusNm;
  const srProUserNm = document.createElement('div');
  srProUserNm.className = 'sr-data-pro-user-nm';
  srProUserNm.textContent = data.proUserNm;
  const srStatusNm = document.createElement('div');
  srStatusNm.className = 'sr-data-status';
  srStatusNm.textContent = data.srmsStatusNm;
  const srProcRate = document.createElement('div');
  srProcRate.className = 'sr-data-proc-rate';
  srProcRate.textContent = data.procRate + '%';

  statusItem.appendChild(srProUserNm);
  statusItem.appendChild(srStatusNm);
  statusItem.appendChild(srProcRate);

  return statusItem;
}

const createDayItemContainerSr = (srData) => {
  const dayItemContainer = document.createElement('div');
  dayItemContainer.className = 'day-item-container-sr';
  dayItemContainer.dataset.srNo = srData.srNo;

  if (typeof srData !== 'undefined') {
      updateDayItemMap(srData);
  }

  return dayItemContainer;
}

const renderItemTree = async (data, parentElement, parentElement2, parentElement3, depth = 1, upperReqrmId = 0) => {
  const ul = document.createElement('ul');
  ul.className = 'hierachy-list';
  const ulStatusContainer = document.createElement('ul');
  ulStatusContainer.className = 'status-container';
  const ulDateContainer = document.createElement('ul');
  ulDateContainer.className = 'date-container';

  data.forEach(item => {
    const li = document.createElement('li');
    li.dataset.depth = depth;
    li.dataset.reqrmId = item.reqrmId;
    li.dataset.upperReqrmId = upperReqrmId;
    li.dataset.sortOrdr = item.sortOrdr;
    li.className = 'toggle-box';
    const liStatusContainerSub = document.createElement('li');
    liStatusContainerSub.className = 'status-container-sub';
    liStatusContainerSub.dataset.reqrmId = item.reqrmId;
    liStatusContainerSub.dataset.upperReqrmId = upperReqrmId;
    const liDateContainerSub = document.createElement('li');
    liDateContainerSub.className = 'date-container-sub';
    liDateContainerSub.dataset.reqrmId = item.reqrmId;
    liDateContainerSub.dataset.upperReqrmId = upperReqrmId;

    const itemContainer = document.createElement('div');
    itemContainer.className = 'item-container';
    const itemContainerSub1 = document.createElement('div');
    itemContainerSub1.className = 'item-container-sub1';
    itemContainerSub1.dataset.reqrmId = item.reqrmId;

    const expandControl = document.createElement('div');
    expandControl.className = 'expand-control';
    expandControl.draggable = true;
    const btnDrag = document.createElement('div');
    btnDrag.className = 'btn-drag';
    btnDrag.appendChild(createIcon('chevron_right'));
    expandControl.appendChild(btnDrag);

    if (hasChildren(item)) {
      const btnToggle = document.createElement('div');
      btnToggle.textContent = '>';
      //btnToggle.appendChild(createIcon('chevron_right'));
      btnToggle.dataset.reqrmId = item.reqrmId;
      btnToggle.className = 'btn-fold';
      btnToggle.dataset.open = 'true';
      expandControl.appendChild(btnToggle);
    }
    itemContainerSub1.appendChild(expandControl);

    const actions = document.createElement('div');
    actions.className = 'actions';

    if (depth == 6) {
      const btnSr = document.createElement('button');
      btnSr.className = 'btn-sr';
      btnSr.appendChild(createIcon('add'));
      actions.appendChild(btnSr);
    } else {
      const btnAdd = document.createElement('button');
      btnAdd.className = 'btn-add';
      btnAdd.appendChild(createIcon('add'));
      actions.appendChild(btnAdd);
    }

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-delete';
    btnDelete.appendChild(createIcon('delete'));
    actions.appendChild(btnDelete);

    itemContainerSub1.appendChild(actions);

    const content = document.createElement('div');
    content.className = 'content';

    const no = document.createElement('div');
    no.className = 'content-no';
    no.textContent = item.sortOrdr.toString().padStart(2, '0');
    content.appendChild(no);
    const title = document.createElement('div');
    title.className = 'content-title';
    title.textContent = item.reqrmNm;
    content.appendChild(title);
    const dcIcon = document.createElement('div');
    dcIcon.className = 'content-description-icon';
    dcIcon.appendChild(createIcon('edit'));//square
    content.appendChild(dcIcon);
    const dc = document.createElement('div');
    dc.className = 'content-description';
    dc.textContent = item.reqrmDc ? item.reqrmDc : '';
    content.appendChild(dc);

    itemContainerSub1.appendChild(content);
    itemContainer.appendChild(itemContainerSub1);

    const itemContainerSub2 = document.createElement('div');
    itemContainerSub2.className = 'item-container-sub2';
    itemContainerSub2.dataset.reqrmId = item.reqrmId;

    if (item.rltSrCnt > 0) {
      const rltSrLists = item.rltSrList;
      const srList = document.createElement('div');
      srList.className = 'sr-list';
      const btnFold = document.createElement('div');
      btnFold.className = 'btn-fold';
      btnFold.textContent = '>';
      btnFold.dataset.reqrmId = item.reqrmId;
      btnFold.dataset.open = 'true';
      expandControl.appendChild(btnFold);

      const statusContainerPad = createStatusContainerPad(upperReqrmId, item.reqrmId);
      liStatusContainerPad.appendChild(statusContainerPad);

      const dayItemContainer = createDayItemContainer(item.reqrmId);
      liDateContainerSub.appendChild(dayItemContainer);

      rltSrLists.forEach(data => {
        const srData = createSrData(data);
        srList.appendChild(srData);

        const statusItem = createSrStatusItem(data);
        liStatusContainerSub.appendChild(statusItem);

        // SR 관련 날짜
        const dayItemContainer = createDayItemContainerSr(data);
        liDateContainerSub.dataset.srNo = data.srNo;
        liDateContainerSub.appendChild(dayItemContainer);
      }); // end of rltSrLists.forEach

      itemContainerSub2.appendChild(srList);
      itemContainer.appendChild(itemContainerSub2);
    } else {
      liStatusContainerSub.className = 'status-container-sub-empty';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'sr-staus-empty-item';
      liStatusContainerSub.appendChild(emptyDiv);

      liDateContainerSub.className = 'date-container-sub-empty';
      const dayItemContainer = createDayItemContainer(item.reqrmId);
      liDateContainerSub.appendChild(dayItemContainer);
    }

    li.appendChild(itemContainer);

    // 자식 요소 재귀
    if (hasChildren(item)) {
      renderItemTree(item.children, li, liStatusContainerSub, liDateContainerSub, depth + 1, item.reqrmId);
    }

    ul.appendChild(li);
    ulStatusContainer.appendChild(liStatusContainerSub);
    ulDateContainer.appendChild(liDateContainerSub);
  });

  parentElement.appendChild(ul);
  parentElement2.appendChild(ulStatusContainer);
  parentElement3.appendChild(ulDateContainer);
}

const toggleFoldAll = async (foldAction) => {
  const displayStr = foldAction == 'unfold' ? '' : 'none';
  const classStr = foldAction == 'unfold' ? '.btn-unfold' : '.btn-fold';
  document.querySelectorAll('.hierachy-list li:not([data-depth="1"])').forEach(el => {
    el.style.display = displayStr;

    const rltEls = document.querySelectorAll(`
      .status-container-sub-empty[data-reqrm-id="${el.dataset.reqrmId}"],
      .status-container-sub[data-reqrm-id="${el.dataset.reqrmId}"],
      .date-container-sub-empty[data-reqrm-id="${el.dataset.reqrmId}"],
      .date-container-sub[data-reqrm-id="${el.dataset.reqrmId}"]
    `);

    rltEls.forEach(rltEl => {
      rltEl.style.display = displayStr;
    });
  });

  document.querySelectorAll(classStr).forEach(el => el.click());
  if (foldAction == 'unfold') localStorage.foldArr = JSON.stringify([]);

  setTimeout(() => {
    hideLoader();
  }, 10);
}

const toggleFold = (dataReqrmId, isOpen) => {
  foldInfo = JSON.parse(localStorage.foldArr);

  if (isOpen) {
    if (!foldInfo.includes(dataReqrmId)) foldInfo.push(dataReqrmId);
  } else {
    const newFoldInfo = foldInfo.filter(item => item != dataReqrmId);
    foldInfo = newFoldInfo;
  }

  localStorage.foldArr = JSON.stringify(foldInfo); const elementsToHide = document.querySelectorAll(
    `.status-container-sub-empty[data-reqrm-id="${reqrmId}"],
   .status-container-sub[data-reqrm-id="${reqrmId}"],
   .date-container-sub-empty[data-reqrm-id="${reqrmId}"],
   .date-container-sub[data-reqrm-id="${reqrmId}"]`
  );

  let rows = document.querySelectorAll(`li[data-upper-reqrm-id="${dataReqrmId}"]`);

  if (rows.length == 0) {
    const sub2 = document.querySelector(`div.item-container-sub2[data-reqrm-id="${dataReqrmId}"]`);
    if (sub2) {
      sub2.style.display = sub2.style.display == '' ? 'none' : '';
    }

    if (isOpen) {
      document.querySelectorAll(`div.sr-status-item[data-reqrm-id="${dataReqrmId}"]`).forEach(row => {
        row.style.display = 'none';
        document.querySelector(`div.day-item-container-sr[data-sr-no="${row.dataset.srNo}"]`).style.display = 'none';
      });
    } else {
      document.querySelectorAll(`div.sr-status-item[data-reqrm-id="${dataReqrmId}"]`).forEach(row => {
        const relElement = document.querySelector(`div.sr-data[data-sr-no="${row.dataset.srNo}"]`);
        row.style.display = relElement.style.display;
        document.querySelector(`div.day-item-container-sr[data-sr-no="${row.dataset.srNo}"]`).style.display = relElement.style.display;
      });
    }
  }

  rows.forEach(row => row.style.display = !isOpen ? '' : 'none');
}

const toggleCompleteSr = (reqrmId) => {
  const srElements = document.querySelectorAll(`div.item-container-sub2[data-reqrm-id="${reqrmId}"] > .sr-data`);
  let hideCount = 0;  // 완료 건만 존재하는 경우 sub2 자체를 숨김

  srElements.forEach(sr => {
    if (sr.dataset.srmsStatusNm != '처리 완료') {
      sr.style.display = '';

      const relElement = document.querySelector(`div.sr-status-item[data-sr-no="${sr.dataset.srNo}"]`);
      relElement.style.display = '';
      const relElement2 = document.querySelector(`div.day-item-container-sr[data-sr-no="${sr.dataset.srNo}"]`);
      relElement2.style.display = '';
    } else {
      const displayYn = sr.style.display == '';
      sr.style.display = displayYn ? 'none' : '';
      if (displayYn) hideCount++;

      const relElement = document.querySelector(`div.sr-status-item[data-sr-no="${sr.dataset.srNo}"]`);
      relElement.style.display = relElement.style.display == '' ? 'none' : '';
      const relElement2 = document.querySelector(`div.day-item-container-sr[data-sr-no="${sr.dataset.srNo}"]`);
      relElement2.style.display = relElement2.style.display == '' ? 'none' : '';
    }
  });

  const sub2 = document.querySelector(`div.item-container-sub2[data-reqrm-id="${reqrmId}"]`);
  if (sub2) {
    if (srElements.length == hideCount) {
      sub2.style.display = 'none';
    } else {
      sub2.style.display = '';
    }
  }
}

const _srBtnLink1Click = (e) => {
  const parentDiv = e.target.closest('div.sr-data');
  const params = { reqSeq: parentDiv.dataset.reqSeq, srNo: parentDiv.dataset.srNo };
  localStorage.setItem('ls.stateParams.app.srms001.detail', JSON.stringify(params));
  const url = $state.href('app.srms001.detail', params);

  if ($scope.openedSr1 && !$scope.openedSr1?.closed) {
    $scope.openedSr1.location.href = url;
    $scope.openedSr1.location.reload();
  } else {
    $scope.openedSr1 = $window.open(url, '_sr_view1');
  }
}

const _srBtnLink2Click = (e) => {
  const parentDiv = e.target.closest('div.sr-data');
  const params = { reqSeq: parentDiv.dataset.reqSeq, srNo: parentDiv.dataset.srNo };
  localStorage.setItem('ls.stateParams.app.srms002.detail', JSON.stringify(params));
  const url = $state.href('app.srms002.detail', params);

  if ($scope.openedSr2 && !$scope.openedSr2?.closed) {
    $scope.openedSr2.location.href = url;
    $scope.openedSr2.location.reload();
  } else {
    $scope.openedSr2 = $window.open(url, '_sr_view2');
  }
}

const _srBtnDateClick = async (e) => {
  const parentDiv = e.target.closest('div.sr-data');

  if (parentDiv && parentDiv.dataset.procStDueDe) {
    const procStDate = parseDateString(parentDiv.dataset.procStDueDe);
    const offsetEl = document.querySelector(`td[data-date='${procStDate.getTime()}']`);

    if (offsetEl) {
      const todayOffsetLeft = document.querySelector(`td[data-date='${new Date().getTime()}']`).offsetLeft;
      document.querySelectorAll('.header-section-3')[0].scrollLeft = todayOffsetLeft;
    } else {
      showLoader();
      await new Promise(resolve => setTimeout(resolve, 0));

      try {
        // 재조회, 렌더링, 이동 => 이동 값을 localStorage에 넣어서 처리
        const offsetTop = e.target.offsetTop;
        localStorage.setItem('srms003.offset.top', offsetTop);
        localStorage.setItem('srms003.offset.date', procStDate.getTime());
        localStorage.setItem('srms003.offset.srNo', parentDiv.dataset.srNo);
  
        if (parentDiv.dataset.procCompDueDe !== '') {
          const procCompDate = parseDateString(parentDiv.dataset.procCompDueDe);
          initialDate(procStDate, procCompDate);
        } else {
          initialDate(procStDate, procStDate);
        }

        await renderDayItems();
      } finally {
        hideLoader();
      }
    }
  }
}

const cleanSrElement = (target) => {
  // SR 요소 관련 제거 (역순: 관련날짜, 관련상태, 해당요소)
  dateObserver.unobserve(target);
  document.querySelector(`div.day-item-container-sr[data-sr-no="${target.dataset.srNo}"]`).remove();
  document.querySelector(`div.sr-status-item[data-sr-no="${target.dataset.srNo}"]`).remove();

  // SR 요소가 모두 삭제되는 경우는 SR 그룹의 클래스 및 요소 재조정
  const container = target.closest('div.item-container-sub2');

  if (container.querySelectorAll('div.sr-data').length == 1) {
    const reqrmId = container.dataset.reqrmId;
    const status = document.querySelector(`li.status-container-sub[data-reqrm-id="${reqrmId}"]`);
    status.className = 'status-container-sub-empty';
    status.querySelector('li.status-container-pad').remove();
    const srStatusItemEmpty = document.createElement('div');
    srStatusItemEmpty.clasSName = 'sr-status-item-empty';
    status.appendChild(srStatusItemEmpty);

    const date = document.querySelector(`li.date-container-sub[data-reqrm-id="${reqrmId}"]`);
    date.className = 'date-container-sub-empty';
    container.remove();
  }

  target.remove();
}

const _srBtnDeleteClick = (e) => {
  const parentDiv = e.target.closest('div.sr-data');
  const parentLi = e.target.closest('li');
  const reqrmVoArr = [{
    reqrmId: parentLi.dataset.reqrmId,
    reqSeq: parentDiv.dataset.reqSeq,
  }];

  const dlg = dialogs.confirm('확인', '지정된 SR을 삭제할까요?');
  dlg.result.then(async (btn) => {
    if (btn == 'yes') {
      srms003Resource.deleteReqrmRlt(reqrmVoArr).then(() => {
        cleanSrElement(e.target.closest('div.sr-data'));
      });
    }
  });
}

const _srBtnDeleteAllClick = (e) => {
  const reqrmId = e.target.closest('li').dataset.reqrmId
  const checkedEl = document.querySelectorAll(`div.item-container-sub2[data-reqrm-id="${reqrmId}"] .sr-check input[type="checkbox"]:checked`)
  let reqrmVoArr = [];

  checkedEl.forEach(el => {
    const reqrmVo = {
      reqrmId: el.dataset.parentReqrmId,
      reqSeq: el.dataset.reqSeq,
    }

    reqrmVoArr.push(reqrmVo);
  });

  const dlg = dialogs.confirm('확인', '지정된 SR을 삭제할까요?');
  dlg.result.then(async (btn) => {
    if (btn == 'yes') {
      srms003Resource.deleteReqrmRlt(reqrmVoArr).then(list => {
        reqrmVoArr.forEach(vo => {
          cleanSrElement(document.querySelector(`div.sr-data[data-req-seq="${vo.reqSeq}"]`));
        });
      });
    }
  });
}

const _wrap1MouseOver = (e) => {
  const parent = document.querySelector('div.sr-section-wrapper1');
  const target = e.target.closest('.content-title');
  if (!target || !parent.contains(target)) return;

  if (!target.contains(e.relatedTarget)) {
    const _reqrmId = e.target.closest('li').dataset.reqrmId;
    const currDepth = e.target.closest(`li[data-reqrm-id="${_reqrmId}"]`).dataset.depth;
    if (currDepth < 3) return;

    let text = '';
    for (let i = 2; i < currDepth; ++i) {
      let tmpNoText = e.target.closest(`li[data-reqrm-id="${_reqrmId}"]`).closest(`li[data-depth="${i}"]`).querySelector('.content-no').textContent;
      let tmpTitleText = e.target.closest(`li[data-reqrm-id="${_reqrmId}"]`).closest(`li[data-depth="${i}"]`).querySelector('.content-title').textContent;
      tmpTitleText = tmpTitleText.replace(/\s*\(\D{1,}\)/, '');
      text += ' | ' + tmpNoText + ' ' + tmpTitleText;
    }

    document.querySelector('#currPath').textContent = text;
    document.querySelector('#currPath').classList.add('curr-path');
    startScroll();
  }
}

const _wrap1MouseOut = (e) => {
  const parent = document.querySelector('div.sr-section-wrapper1');
  const target = e.target.closest('.content-title');
  if (!target || !parent.contains(target)) return;

  if (!target.contains(e.relatedTarget)) {
    stopScroll();
    document.querySelector('#currPath').textContent = '요구사항 분류 및 관련 SR';
    document.querySelector('#currPath').classList.remove('curr-path');
  }
}

const wrap1Change = (e) => {
  const el = e.target.tagName;
  const cl = e.target.className;

  if (el === 'INPUT' && cl === 'sr-check-input') {
    if (e.target.checked) {
      deleteAllSr.push(e.target.dataset.srNo);
    } else {
      let index = deleteAllSr.indexOf(e.target.dataset.srNo);
      if (index != -1) {
        deleteAllSr.splice(index, 1);
      }
    }

    const allCheckboxEl = document.querySelectorAll(`div.item-container-sub2[data-reqrm-id="${e.target.dataset.parentReqrmId}"] .sr-check input[type="checkbox"]`);
    const checkedEl = document.querySelectorAll(`div.item-container-sub2[data-reqrm-id="${e.target.dataset.parentReqrmId}"] .sr-check input[type="checkbox"]:checked`);
    allCheckboxEl.forEach(el => el.parentElement.parentElement.lastChild.classList.add('hide'));
    if (deleteAllSr.length > 0) checkedEl[0].parentElement.parentElement.lastChild.classList.remove('hide');
  }
}

const wrap1Click = (e) => {
  const el = e.target.tagName;
  const cl = e.target.className;
  console.log('wrap1', el, cl);

  if (el === 'DIV') {
    if (cl === 'btn-fold' || cl === 'btn-unfold') {
      const dataReqrmId = e.target.dataset.reqrmId;
      const isOpen = e.target.dataset.open === 'true';
      e.target.dataset.open = (!isOpen).toString();

      if (isOpen) {
        e.target.classList.add('btn-unfold');
        e.target.classList.remove('btn-fold');
      } else {
        e.target.classList.remove('btn-unfold');
        e.target.classList.add('btn-fold');
      }

      toggleFold(dataReqrmId, isOpen);
    } else if (cl === 'btn-uncomplete') {
      if (e.target.textContent == '전체') e.target.textContent = '진행';
      else e.target.textContent = '전체';

      toggleCompleteSr(e.target.dataset.reqrmId);
    } else if (cl === 'content-description-icon') {
      const _reqrmId = e.target.closest('li').dataset.reqrmId;
      openReqrmPop(_reqrmId, 'edit');
    } else if (cl === 'sr-btn-link1') {
      _srBtnLink1Click(e);
    } else if (cl === 'sr-btn-link2') {
      _srBtnLink2Click(e);
    } else if (cl === 'sr-btn-date') {
      _srBtnDateClick(e);
    } else if (cl === 'sr-btn-delete') {
      _srBtnDeleteClick(e);
    } else if (cl === 'sr-btn-delete-all') {
      _srBtnDeleteAllClick(e);
    }
  } else if (el === 'BUTTON') {
    const _reqrmId = e.target.closest('li').dataset.reqrmId;

    if (cl === 'btn-sr') {
      openSrPop(_reqrmId);
    } else if (cl === 'btn-add') {
      openReqrmPop(_reqrmId);
    } else if (cl === 'btn-delete') {
      deleteReqrm(e);
    }
  } else if (el === 'SPAN') {
    const parentBtn = e.target.closest('button');
    const parentDiv = e.target.closest('div');
    const _reqrmId = e.target.closest('li').dataset.reqrmId;

    if (parentBtn) {
      const pcl = parentBtn.className;

      if (pcl === 'btn-sr') {
        openSrPop(_reqrmId);
      } else if (pcl === 'btn-add') {
        openReqrmPop(_reqrmId);
      } else if (pcl === 'btn-delete') {
        deleteReqrm(e);
      }
    } else if (parentDiv) {
      const pcl = parentDiv.className;
      if (pcl === 'content-description-icon') {
        openReqrmPop(_reqrmId, 'edit');
      } else if (pcl === 'sr-btn-link1') {
        _srBtnLink1Click(e);
      } else if (pcl === 'sr-btn-link2') {
        _srBtnLink2Click(e);
      } else if (pcl === 'sr-btn-date') {
        _srBtnDateClick(e);
      } else if (pcl === 'sr-btn-delete') {
        _srBtnDeleteClick(e);
      } else if (pcl === 'sr-btn-delete-all') {
        _srBtnDeleteAllClick(e);
      }
    }
  }
}

let draggedItem = null;
let originalDepth = null;

const wrap1DragStart = (e) => {
  const el = e.target.tagName;
  const cl = e.target.className;
  if (el === 'DIV' && cl === 'expand-control') {
    const ghotEl = document.getElementById('drag-ghost');
    e.dataTransfer.setDragImage(ghotEl, 0, 0);
    e.dataTransfer.effectAllowed = 'move';

    draggedItem = e.target.closest('li');
    originalDepth = draggedItem.dataset.depth;
  }
}

const wrap1DragOver = (e) => {
  const targetLi = e.target.closest('li');

  if ((targetLi?.dataset.depth == originalDepth
        || targetLi?.dataset.depth == (originalDepth - 1))
      && targetLi != draggedItem.parentElement.closest('li')
      && targetLi.netElementSibling != draggedItem) {

    e.preventDefault();
    targetLi.children[0].classList.add('drag-over');
  }
}

const wrap1DragLeave = (e) => {
  e.target.closest('li').children[0].classList.remove('drag-over');
}

const wrap1Drop = (e) => {
      // 드래그한 아이템의 reqrmId(소속)을 target의 id로 변경함
      e.preventDefault();
      const targetLi = e.target.closest('li');
      targetLi?.classList.remove('drag-over');

      // 이 if는 dragover에서 미리 차단되어 삭제될 수 있음
      if (draggedItem && targetLi
            && (targetLi.dataset.depth == originalDepth || targetLi?.dataset.depth == (originalDepth - 1))) {

        const refNode = targetLi !== draggedItem ? targetLi : null;

        if (refNode != null) {  // refNode: 드랍대상, 자신과 동일 계층 또는 직전 계층만 드랍
          // 갱신
          const reqrmOrderVo = {
            // 이동될 객체
            replaceUpperReqrmId: refNode.dataset.upperReqrmId,
            replaceSortOrdr: refNode.dataset.sortOrdr,

            // 이동 대상
            reqrmId: draggedItem.dataset.reqrmId,
            upperReqrmId: draggedItem.dataset.upperReqrmId,
            sortOrdr: draggedItem.dataset.sortOrdr,
          };

          if (targetLi?.dataset.depth == (originalDepth - 1)) {
            reqrmOrderVo.replaceUpperReqrmId = refNode.dataset.reqrmId;
            reqrmOrderVo.replaceSortOrdr = 0;
          }

          const dlg = dialogs.confirm('확인', '이동할까요?');
          dlg.result.then(async (btn) => {
            if (btn == 'yes') {
              const toMoveElement = draggedItem.cloneNode(true);

              // 이동 요소가 있던 위치의 다음 형제들에 대한 처리
              let nextSrcEl = draggedItem.nextElementSibling;

              while (nextSrcEl) {
                nextSrcEl.dataset.sortOrdr = parseInt(nextSrcEl.dataset.sortOrdr) - 1;
                nextSrcEl.querySelector('div.content-no').textContent = nextSrcEl.dataset.sortOrdr.toString().padStart(2, '0');
                nextSrcEl = nextSrcEl.nextElementSibling;
              }

              draggedItem.remove();

              srms003Resource.updateReqrmOrder(reqrmOrderVo).then(() => {
                // 이동 요소의 부모참조ID, 정렬순서, 순번텍스트 변경
                const parentReqrmId = targetLi.parentElement.closest('li').dataset.reqrmId;
                toMoveElement.dataset.upperReqrmId = parentReqrmId;
                toMoveElement.dataset.sortOrdr = parseInt(targetLi.dataset.sortOrdr) + 1;
                toMoveElement.querySelector('div.content-no').textContent = toMoveElement.dataset.sortOrdr.toString().padStart(2, '0');

                // 이동 요소의 상태 이동
                let statusEl = document.querySelector(`li.status-container-sub-empty[data-reqrm-id="${toMoveElement.dataset.reqrmId}"]`);
                let targetStatusEl = document.querySelector(`li.status-container-sub-empty[data-reqrm-id="${targetLi.dataset.reqrmId}"]`);
                if (!statusEl) statusEl = document.querySelector(`li.status-container-sub[data-reqrm-id="${toMoveElement.dataset.reqrmId}"]`);
                if (!targetStatusEl) targetStatusEl = document.querySelector(`li.status-container-sub[data-reqrm-id="${targetLi.dataset.reqrmId}"]`);
                targetStatusEl.after(statusEl);

                // 이동 요소의 날짜 이동
                let dateEl = document.querySelector(`li.date-container-sub-empty[data-reqrm-id="${toMoveElement.dataset.reqrmId}"]`);
                let targetDateEl = document.querySelector(`li.date-container-sub-empty[data-reqrm-id="${targetLi.dataset.reqrmId}"]`);
                if (!dateEl) dateEl = document.querySelector(`li.date-container-sub[data-reqrm-id="${toMoveElement.dataset.reqrmId}"]`);
                if (!targetDateEl) targetDateEl = document.querySelector(`li.date-container-sub[data-reqrm-id="${targetLi.dataset.reqrmId}"]`);
                targetDateEl.after(dateEl);

                // 이동 요소의 다음 형제들에 대한 처리
                let nextEl = targetLi.nextElementSibling;
                while (nextEl) {
                  nextEl.dataset.sortOrdr = parseInt(nextEl.dataset.sortOrdr) + 1;
                  nextEl.querySelector('div.content-no').textContent = nextEl.dataset.sortOrdr.toString().padStart(2, '0');
                  nextEl = nextEl.nextElementSibling;
                }

                targetLi.after(toMoveElement);
                applyObservation();
              });
            }

            draggedItem = null;
            originalDepth = null;
          });
        }
      }

}

let tdColSpan;
let ranges;

const reloadTdColSpan = () => {
  tdColSpan = document.querySelectorAll('.table-container td[colspan]');
  ranges = [];
  tdColSpan.forEach(el => ranges.push(el.offsetLeft));
}

const applyStylingAndInteractivity = () => {  // ref::eventManager
  const wrapper1 = document.querySelector('.sr-section-wrapper1');
  eventManager.add(wrapper1, 'click', wrap1Click);
  eventManager.add(wrapper1, 'mouseover', _wrap1MouseOver);
  eventManager.add(wrapper1, 'mouseout', _wrap1MouseOut);
  eventManager.add(wrapper1, 'change', wrap1Change);
  eventManager.add(wrapper1, 'dragstart', wrap1DragStart);
  eventManager.add(wrapper1, 'dragover', wrap1DragOver);
  eventManager.add(wrapper1, 'dragleave', wrap1DragLeave);
  eventManager.add(wrapper1, 'drop', wrap1Drop);

  document.querySelector('#searchFirstDepth').addEventListener('click', () => {
    localStorage.setItem('srms003.search.value', document.querySelector('#firstDepthList').value);
    location.reload();
  });

  document.querySelector('#searchFirstDepth').addEventListener('click', detail);
  document.querySelector('#addFirstDepth').addEventListener('click', () => openReqrmPop(0));
  document.querySelector('#clickFoldAll').addEventListener('click', () => toggleFoldAll('fold'));
  document.querySelector('#clickUnfoldAll').addEventListener('click', () => toggleFoldAll('unfold'));
  document.querySelector('#moveNextSr').addEventListener('click', () => scrollToSrSection('next'));
  document.querySelector('#movePrevSr').addEventListener('click', () => scrollToSrSection('prev'));;
  document.querySelector('#moveToday').addEventListener('click', moveToToday);
  document.querySelector('#reqrmPop .cancel').addEventListener('click', closeReqrmPop);
  document.querySelector('#reqrmPop .submit').addEventListener('click', saveReqrm);
  document.querySelector('#srPop .cancel').addEventListener('click', closeSrPop);
  document.querySelector('#srPop .submit').addEventListener('click', saveSr);
  const headerSec3 = document.querySelector('.header-section-3');
  const srSecWrap1 = document.querySelector('.sr-section-wrapper1');
  const srSecWrap2 = document.querySelector('.sr-section-wrapper2');
  headerSec3.addEventListener('scroll', () => srSecWrap2.scrollLeft = headerSec3.scrollLeft);
  srSecWrap1.addEventListener('scroll', () => srSecWrap2.scrollTop = srSecWrap1.scrollTop);
  srSecWrap2.addEventListener('scroll', () => {
    srSecWrap1.scrollTop = srSecWrap2.scrollTop;
    headerSec3.scrollLeft = srSecWrap2.scrollLeft;
  });

  reloadTdColSpan();

  headerSec3.addEventListener('scroll', () => {
    max = Math.max(...ranges.filter(val => val <= headerSec3.scrollLeft));
    const index = ranges.indexOf(max);
    if (index < ranges.length) {  // 마지막 인덱스가 아니면
      tdColSpan.forEach(el => {
        if (el.offsetLeft == max) {
          el.classList.remove('td-left');
          el.classList.add('td-right');
        } else {
          el.classList.remove('td-right');
          el.classList.add('td-left');
        }
      });
    }
  });
}

let textAnimationInstance = null;

const startScroll = () => {
  const scrollText = document.querySelector('#currPath');
  const scrollArea = document.querySelector('.header-title-left');
  const textWidth = scrollText.scrollWidth;
  const areaWidth = scrollArea.clientWidth;

  if (textAnimationInstance) {
    textAnimationInstance.cancel();
    textAnimationInstance = null;
  }

  if (textWidth > areaWidth) {
    const delta = textWidth - areaWidth;
    const correctionRatio = 1 + 0.4 * Math.exp(-delta / 200);  // 지수 감쇠 함수
    const moveX = -(delta * correctionRatio);
    const baseDuration = 2000;
    const duration = baseDuration * (1 + 2 * (1 - Math.exp(-delta / 200)));

    textAnimationInstance = scrollText.animate(
      [{ transform: `translateX(15px)` },
      { transform: `translateX(${moveX}px)` }],
      {
        duration: duration,  // 속도 조절
        iterations: Infinity,  // 무한 반복
        direction: 'alternate',  // 왕복
        easing: 'linear',
      });
  } else {
    scrollText.style.transform = 'translateX(15px)';
  }
}

const stopScroll = () => {
  if (textAnimationInstance) {
    textAnimationInstance.cancel();
    textAnimationInstance = null;
  }

  const scrollText = document.querySelector('#currPath');
  scrollText.style.transform = 'translateX(15px)';
}

const applyObservation = () => {
  if (dateObserver) {
    dateTargets.forEach(el => dateObserver.unobserve(el));
    dateObserver.disconnect();
  }

  // 리스트의 가상 스크롤링을 위한 옵저버, 각 리스트가 나타나면 최소, 최대값을 가지고 프래그먼트 내용을 추출한다
  dateTargets = document.querySelectorAll('div.item-container-sub1, div.sr-data');
  dateObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const srNo = entry.target.dataset.srNo;
      const reqrmId = entry.target.dataset.reqrmId;
      let targetEl;

      if (typeof srNo !== 'undefined') {
        targetEl = document.querySelector(`div.day-item-container-sr[data-sr-no="${srNo}"]`);
      } else {
        targetEl = document.querySelector(`div.day-item-container[data-reqrm-id="${reqrmId}"]`);
      }

      if (entry.isIntersecting) {
        if (targetEl) {
          targetEl.innerHTML = '';
        }
      } else {
        if (typeof srNo !== 'undefined') {
          const _dayItem = dayItemMap.get(srNo).cloneNode(true);
          targetEl.appendChild(_dayItem);
        } else {
          targetEl.appendChild(partlyDayItemFrag.cloneNode(true));
        }
      }
    });
  }, {
    root: document.querySelector('div.sr-section-wrapper1'),  // 날짜 영역을 표시할때 깜빡임을 최소화 하기 위해 영역을 지정하고 rootMargin을 상하로 확장
    rootMargin: "1000px 0px",
    threshold: 0
  });

  dateTargets.forEach(el => dateObserver.observe(el));
}
