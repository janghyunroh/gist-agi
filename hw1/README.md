# HW 1. Othello AI 만들기

## 1. Environment

- 구동 환경: 웹 브라우저
- 사용 언어: 자바스크립트
- 구동 방식: Static Script Upload
    자바스크립트 파일을 올리면 해당 파일을 이용해 new Function을 만듦. 해당 함수는 플레이어 턴마다 실행되며, board와 player를 기반으로 move 객체를 반환하여 수를 둠. 따라서 해당 형식에 맞게 파일을 작성해야 함. 
- 접근 가능한 변수
    - player : 정수. 1이면 흑, 2이면 백을 나타냄. 
    - board : 8x8 배열 객체. 각 셀은 0: 빈 칸, 1: 흑, 2: 백백
    - validMove(player): 현재 board를 기준으로, 턴이 player의 턴인 경우 player가 둘 수 있는 모든 move들을 배열로 반환

- final output: move 객체(row와 col로 이루어진 dictionary)

## 2. 게임 규칙 생각해보기

1. 코너 먹기

코너는 무조건 먹는게 이득일 것 같음. 절대 뒤집힐 일 없는 칸. 
이 칸을 기반으로 뒤집힐 일 없는 돌을 점점 넓혀나갈 수도 있음.

물론 코너를 너무 늦게 먹으면 의미가 없어짐. 따라서 코너를 우선시하더라도 정도가 필요할 듯. 

2. 코너 먹히지 않기

상대가 코너를 먹는 걸 최대한 늦춰야 함. 