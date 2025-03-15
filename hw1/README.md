# HW 1. Othello AI 만들기

## 1. Environment

- 구동 환경: 웹 브라우저
- 사용 언어: 자바스크립트





- 접근 가능한 변수
    - player
    - board
    - validMove(player): 현재 board를 기준으로, 턴이 player의 턴인 경우 player가 둘 수 있는 모든 move들을 배열로 반환

- final output: move 객체(row와 col로 이루어진 dictionary)

## 2. 게임 규칙 생각해보기

1. 코너 먹기

코너는 무조건