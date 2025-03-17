import re
import csv

def init_board():
    """표준 오셀로 초기 보드 상태 생성 (0: empty, 1: Black, 2: White)"""
    board = [[0]*8 for _ in range(8)]
    board[3][3] = 2  # White
    board[3][4] = 1  # Black
    board[4][3] = 1  # Black
    board[4][4] = 2  # White
    return board

def move_to_coords(move_str):
    """
    문자열 형식의 착수(예: 'c4')를 (row, col) 튜플로 변환 (0-indexed)
    a->0, b->1, ..., h->7, row 숫자는 1부터 시작하므로 -1함.
    """
    col = ord(move_str[0].lower()) - ord('a')
    row = int(move_str[1]) - 1
    return (row, col)

def is_on_board(r, c):
    return 0 <= r < 8 and 0 <= c < 8

def apply_move(board, move, player):
    """
    주어진 board(2차원 리스트)에 대해, player(1: Black, 2: White)가 move를 두고
    오셀로 규칙에 따라 상대 돌을 뒤집어 업데이트한 새 board를 반환합니다.
    """
    r, c = move
    new_board = [row[:] for row in board]
    new_board[r][c] = player
    opp = 1 if player == 2 else 2
    directions = [(-1,-1), (-1,0), (-1,1),
                  (0,-1),         (0,1),
                  (1,-1),  (1,0), (1,1)]
    for dr, dc in directions:
        rr, cc = r + dr, c + dc
        pieces_to_flip = []
        while is_on_board(rr, cc) and new_board[rr][cc] == opp:
            pieces_to_flip.append((rr, cc))
            rr += dr
            cc += dc
        if is_on_board(rr, cc) and new_board[rr][cc] == player:
            for (fr, fc) in pieces_to_flip:
                new_board[fr][fc] = player
    return new_board

def parse_pgn(file_path):
    """
    PGN 파일을 읽어 게임별로 파싱하여 리스트로 반환.
    각 게임은 헤더(dict)와 moves 리스트(착수 문자열들)를 포함합니다.
    """
    games = []
    with open(file_path, 'r') as f:
        content = f.read()
    # 게임은 빈 줄로 구분된다고 가정
    game_blocks = re.split(r'\n\s*\n', content.strip())
    for block in game_blocks:
        lines = block.splitlines()
        headers = {}
        moves = []
        for line in lines:
            if line.startswith('['):
                # 헤더 라인: [Tag "Value"]
                m = re.match(r'\[(\w+)\s+"(.+)"\]', line)
                if m:
                    tag, value = m.groups()
                    headers[tag] = value
            else:
                # 착수 라인: 예) "1. c4 e3"
                # 숫자와 점 제거 후, 공백으로 분리
                line = re.sub(r'\d+\.', '', line)
                line_moves = line.strip().split()
                moves.extend(line_moves)
        games.append({'headers': headers, 'moves': moves})
    return games

def board_to_flat(board):
    """2차원 board를 1차원 문자열 리스트로 변환 (CSV에 기록하기 위함)"""
    return [str(cell) for row in board for cell in row]

def process_games(games, output_csv):
    """
    각 게임에 대해 초기 보드에서 시작해, 각 착수마다 (board state, move index)의 학습 예제를 생성하여 CSV 파일로 저장.
    착수 위치는 (row, col)를 0~63 인덱스로 변환합니다.
    """
    with open(output_csv, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['board', 'move'])  # header: board는 64개 숫자 문자열, move는 0~63 인덱스
        for game in games:
            board = init_board()
            # Black이 먼저 시작 (오셀로 규칙)
            player_turn = 1
            for move_str in game['moves']:
                # 결과(예: "37-27")와 같이 move 형식이 아닌 경우 건너뜁니다.
                if re.match(r'\d+-\d+', move_str):
                    continue
                try:
                    move = move_to_coords(move_str)
                except Exception as e:
                    continue
                # 저장할 학습 예제: 현재 board state와 move의 index (row*8 + col)
                move_index = move[0]*8 + move[1]
                writer.writerow([' '.join(board_to_flat(board)), move_index])
                # board state 업데이트: move 적용
                board = apply_move(board, move, player_turn)
                # 플레이어 전환
                player_turn = 1 if player_turn == 2 else 2
    print(f"Training data saved to {output_csv}")

if __name__ == '__main__':
    pgn_file = './datas'
    output_csv = 'training_data.csv'
    games = parse_pgn(pgn_file)
    process_games(games, output_csv)
