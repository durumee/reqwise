- 요구사항 목록 getReqrmList
```
  reqrmList = getReqrmList()

  for (vo : reqrmList) {
    if (vo.getRltSrCnt() > 0) {  // 요구사항 관련 SR 건수 존재 시 관련 SR 정보를 추가 조회
      rltSrList = getRltSrList(vo)
      vo.setRltSrList(rltSrList)
    }
  }
```
```
SELECT A.REQRM_ID
,      A.UPPER_REQRM_ID
,      A.REQRM_NM
,      A.REQRM_DC
,      A.SORT_ORDR
,      (SELECT COUNT(*)
        FROM   SRMS_REQRM_RLT R
        ,      SRMS_DATA S
        WHERE  R.REQRM_ID = A.REQRM_ID
        AND    R.REQ_SEQ = S.REQ_SEQ
        AND    S.USE_YN = 'Y'
        ) AS RLT_SR_CNT
,    LTRIM(SYS_CONNECT_BY_PATH(LPAD(A.SORT_ORDR, 2, '0'), '-'), '-') AS PATH
,    LEVEL AS DEPTH
FROM  SRMS_REQRM A
WHERE A.DEL_YN = 'N'
START WITH A.UPPER_REQRM_ID = 0
CONNECT BY PRIOR A.REQRM_ID = A.UPPER_REQRM_ID
ORDER SIBLINGS BY A.SORT_ORDR
```

- 미지정 SR목록 getSrList
```
SELECT D.REQ_SEQ
,      D.SR_NO
,      D.SRMS_TITLE
,      D.PROC_RATE
FROM   SRMS_DATA D
WHERE  NOT EXISTS (SELECT 1 FROM SRMS_REQRM_RLT R WHERE R.REQ_SEQ = D.REQ_SEQ)
AND    D.USE_YN = 'Y'
ORDER BY D.SR_NO
```

- 요구사항 관련 SR목록 getRltSrList
```
WITH PROC_RATE_AGGR AS (
  SELECT REQ_SEQ
  ,      AGGR_CONCAT(TO_CHAR(PROC_RATE_DAY, 'YYYYMMDD')||','||PROC_RATE, '|') AS PROC_RATES
  ,      SUM(PROC_RATE) AS PROC_RATE
  FROM   SRMS_DAY_PROC_RATE
  GROUP BY REQ_SEQ
)
SELECT S.REQ_SEQ
,      S.SR_NO
,      S.SRMS_TITLE
,      NVL(P.PROC_RATE, 0) AS PROC_RATE
,      S.SRMS_STATUS
,      S.PROC_ST_DUE_DE
,      S.PROC_COMP_DUE_DE
,      P.PROC_RATES
,      (SELECT CODE_NM FROM CMU_DETAIL_CODE WHERE CODE_ID = 'SRMS_STATUS' AND CODE = S.SRMS_STATUS) AS SRMS_STATUS_NM
,      (SELECT NM FROM USER WHERE USER_ID = S.PRO_USER_ID) AS PRO_USER_NM
FROM   SRMS_REQRM_RLT R
,      SRMS_DATA S
,      PROC_RATE_AGGR P
WHERE  R.REQRM_ID = #{reqrmId}
AND    R.REQ_SEQ = S.REQ_SEQ
AND    S.USE_YN = 'Y'
AND    R.REQ_SEQ = P.REQ_SEQ(+)
ORDER BY S.PROC_RATE, S.SR_NO
```

- 요구사항 관련 SR추가 saveReqrmRlt

- 요구사항 관련 SR삭제 deleteReqrmRlt

- 요구사항 추가 saveReqrm

- 요구사항 수정 updateReqrm

- 요구사항 삭제 deleteReqrm
```
  updateDelYnReqrm(vo)
  deleteReqrmRltAll(vo)
  updateSortReqrm(vo)
```

```
updateDelYnReqrm

UPDATE SRMS_REQRM
SET DEL_YN = 'Y'
WHERE REQRM_ID IN (
  SELECT A.REQRM_ID
  FROM SRMS_REQRM A
  START WITH A.REQRM_ID = #{reqrmId}
  CONNECT BY PRIOR A.REQRM_ID = A.UPPER_REQRM_ID
  )
```

```
deleteReqrmRltAll
DELETE SRMS_REQRM_RLT
WHERE REQRM_ID IN (
  SELECT A.REQRM_ID
  FROM SRMS_REQRM A
  START WITH A.REQRM_ID = #{reqrmId}
  CONNECT BY PRIOR A.REQRM_ID = A.UPPER_REQRM_ID
)
```

```
updateSortReqrm

MERGE INTO SRMS_REQRM A
USING (
  SELECT REQRM_ID
  ,      SORT_ORDR
  ,      ROW_NUMBER() OVER (ORDER BY SORT_ORDR) AS NEW_SORT_ORDR
  FROM   SRMS_REQRM
  WHERE
    UPPER_REQRM_ID IN (
      SELECT UPPER_REQRM_ID
      FROM SRMS_REQRM
      WHERE REQRM_ID = #{reqrmId}
    )
  AND DEL_YN = 'N'
) SORTED_ROWS
ON (A.REQRM_ID = SORTED_ROWS.REQRM_ID)
WHEN MATCHED THEN
UPDATE SET A.SORT_ORDR = SORTED_ROWS.NEW_SORT_ORDR
```

- 요구사항 순서변경 updateReqrmOrder
```
int upperReqrmId = vo.getUpperReqrmId()
int replaceUpperReqrmId = vo.getReplaceUpperReqrmId()
int sortOrdr = vo.getSortOrdr()
int replaceSortOrdr = vo.getReplaceSortOrdr()

if (replaceSortOrdr == 0) {  // 다른 분류로 드랍하면서 자식레벨이 없는 경우
  updateReqrmOrdr(vo)           // 변경대상의 정렬순서를 변경 처리 (새 분류에 들어가므로 1로 변경)
  updateUpperReqrmId(vo)        // 변경대상의 상위요구사항ID를 드랍객체의 상위요구사항ID로 변경
  updateReqrmOrdrMinusOne(vo)   // 변경대상이 기존에 속한 부모의 자식 계층 정렬 순서 정리
  updateReqrmOrdrPlusOne(vo)    // 해당 상위요구사항ID를 가진 대상을 +1 처리하여 정리
} else if (upperReqrmId != replaceUpperReqrmId) {  // 비 동일 레벨
  vo.setReplaceSortOrdr(replaceSortOrdr + 1)  // 변경대상의 정렬순서를 변경처리 (드랍 객체의 다음 순번으로 지정)
  updateReqrmOrdr(vo)

  updateReqrmOrdrPlusOne(vo)    // 드랍 객체의 동일 레벨 다음 데이터의 정렬 순서를 각각 +1 처리
  updateUpperReqrmId(vo)        // 변경대상의 상위요구사항ID를 드랍객체의 상위요구사항ID로 변경
} else {  // 동일 레벨
  if (sortOrdr < replaceSortOrdr) {  // 높은 정렬순서로 이동할때
    updateReqrmOrdrUpDecrease(vo)  // sortOrdr 초과부터 replaceSortOrdr 까지 -1
  } else {  // 낮은 정렬 순서로 이동할때
    updateReqrmOrdrDownIncrese(vo)  // replaceSortOrdr 에서 sortOrdr - 1 까지 +1
  }

  updateReqrmOrdr(vo)  // 변경대상 정렬순서 확정
}
```

```
updateReqrmOrdr

UPDATE SRMS_REQRM
SET SORT_ORDR = #{replaceSortOrdr}
WHERE REQRM_ID = #{reqrmId}

updateReqrmOrdrPlusOne

UPDATE SRMS_REQRM
SET SORT_ORDR = SORT_ORDR + 1
WHERE UPPER_REQRM_ID = #{replaceUpperReqrmId}
AND SORT_ORDR >= #{replaceSortOrdr}

updateReqrmOrdrMinusOne

UPDATE SRMS_REQRM
SET SORT_ORDR = SORT_ORDR - 1
WHERE UPPER_REQRM_ID = #{upperReqrmId}
AND SORT_ORDR > #{sortOrdr}

updateUpperReqrmId

UPDATE SRMS_REQRM
SET UPPER_REQRM_ID = #{replaceUpperReqrmId}
WHERE REQRM_ID = #{reqrmId}

updateReqrmOrdrUpDecrease

UPDATE SRMS_REQRM
SET SORT_ORDR = SORT_ORDR - 1
WHERE UPPER_REQRM_ID = #{upperReqrmId}
AND SORT_ORDR BETWEEN #{sortORdr} + 1 AND #{replaceSortOrdr}

updateReqrmOrdrDownIncrese

UPDATE SRMS_REQRM
SET SORT_ORDR = SORT_ORDR + 1
WHERE UPPER_REQRM_ID = #{upperReqrmId}
AND SORT_ORDR BETWEEN #{replaceSortOrdr} AND #{sortOrdr} - 1

```
