from flask import Blueprint, request, jsonify
from database import get_db_connection
from mysql.connector import Error

bp = Blueprint('scores', __name__)

@bp.route('/api/v1/scores', methods=['GET'])
def get_scores():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    
    try:
        cursor = conn.cursor(dictionary=True)
        # Fetch matches and their participants using GROUP_CONCAT to mimic old format for frontend stability
        query = """
            SELECT 
                m.*,
                (SELECT GROUP_CONCAT(p.name SEPARATOR ', ') 
                 FROM match_participants mp 
                 JOIN players p ON mp.player_id = p.id 
                 WHERE mp.match_id = m.id AND mp.team = 'A') as team_a_players,
                (SELECT GROUP_CONCAT(p.name SEPARATOR ', ') 
                 FROM match_participants mp 
                 JOIN players p ON mp.player_id = p.id 
                 WHERE mp.match_id = m.id AND mp.team = 'B') as team_b_players
            FROM matches m 
            ORDER BY m.match_date DESC, m.id DESC
        """
        cursor.execute(query)
        scores = cursor.fetchall()
        
        grouped_scores = {}
        for row in scores:
            date_str = str(row['match_date'])
            if date_str not in grouped_scores:
                grouped_scores[date_str] = []
            
            row['match_date'] = date_str
            grouped_scores[date_str].append(row)
            
        return jsonify(grouped_scores)
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@bp.route('/api/v1/scores', methods=['POST'])
def add_score():
    data = request.json
    match_date = data.get('match_date')
    match_type = data.get('match_type')
    team_a_players = data.get('team_a_players') # Comma separated names
    team_b_players = data.get('team_b_players') # Comma separated names
    score_a = data.get('score_a', 0)
    score_b = data.get('score_b', 0)
    
    if not all([match_date, match_type, team_a_players, team_b_players]):
        return jsonify({"error": "Missing required fields"}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = conn.cursor()
        # 1. Insert Match
        cursor.execute("""
            INSERT INTO matches (match_date, match_type, score_a, score_b)
            VALUES (%s, %s, %s, %s)
        """, (match_date, match_type, score_a, score_b))
        match_id = cursor.lastrowid

        # 2. Add Participants
        def process_team(names_str, team_label):
            names = [n.strip() for n in names_str.split(',') if n.strip()]
            for name in names:
                # Ensure player exists
                cursor.execute("INSERT IGNORE INTO players (name) VALUES (%s)", (name,))
                cursor.execute("SELECT id FROM players WHERE name = %s", (name,))
                player_id = cursor.fetchone()[0]
                # Link to match
                cursor.execute("""
                    INSERT INTO match_participants (match_id, player_id, team)
                    VALUES (%s, %s, %s)
                """, (match_id, player_id, team_label))

        process_team(team_a_players, 'A')
        process_team(team_b_players, 'B')

        conn.commit()
        return jsonify({"status": "Score added", "id": match_id}), 201
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@bp.route('/api/v1/scores/<int:match_id>', methods=['DELETE'])
def delete_score(match_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM matches WHERE id = %s", (match_id,))
        conn.commit()
        return jsonify({"status": "Score deleted"}), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@bp.route('/api/v1/scores/<int:match_id>', methods=['PUT'])
def update_score(match_id):
    data = request.json
    match_date = data.get('match_date')
    match_type = data.get('match_type')
    team_a_players = data.get('team_a_players')
    team_b_players = data.get('team_b_players')
    score_a = data.get('score_a', 0)
    score_b = data.get('score_b', 0)
    
    if not all([match_date, match_type, team_a_players, team_b_players]):
        return jsonify({"error": "Missing required fields"}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = conn.cursor()
        # 1. Update Match
        cursor.execute("""
            UPDATE matches 
            SET match_date = %s, match_type = %s, score_a = %s, score_b = %s
            WHERE id = %s
        """, (match_date, match_type, score_a, score_b, match_id))

        # 2. Clear existing participants for this match
        cursor.execute("DELETE FROM match_participants WHERE match_id = %s", (match_id,))

        # 3. Re-add Participants
        def process_team(names_str, team_label):
            names = [n.strip() for n in names_str.split(',') if n.strip()]
            for name in names:
                cursor.execute("INSERT IGNORE INTO players (name) VALUES (%s)", (name,))
                cursor.execute("SELECT id FROM players WHERE name = %s", (name,))
                res = cursor.fetchone()
                if res:
                    player_id = res[0]
                    cursor.execute("""
                        INSERT INTO match_participants (match_id, player_id, team)
                        VALUES (%s, %s, %s)
                    """, (match_id, player_id, team_label))

        process_team(team_a_players, 'A')
        process_team(team_b_players, 'B')

        conn.commit()
        return jsonify({"status": "Score updated", "id": match_id}), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@bp.route('/api/v1/scores/bulk-update-date', methods=['POST'])
def bulk_update_date():
    data = request.json
    old_date = data.get('old_date')
    new_date = data.get('new_date')
    
    if not old_date or not new_date:
        return jsonify({"error": "Missing old_date or new_date"}), 400
        
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
        
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE matches SET match_date = %s WHERE match_date = %s", (new_date, old_date))
        conn.commit()
        return jsonify({"status": "Bulk update successful", "updated_rows": cursor.rowcount}), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@bp.route('/api/v1/stats', methods=['GET'])
def get_stats():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        # Calculate stats based on individual games (wins/losses)
        query = """
            SELECT 
                p.name,
                SUM(CASE WHEN mp.team = 'A' THEN m.score_a ELSE m.score_b END) as wins,
                SUM(CASE WHEN mp.team = 'A' THEN m.score_b ELSE m.score_a END) as losses,
                COUNT(m.id) as match_series_played,
                SUM(m.score_a + m.score_b) as total_games
            FROM players p
            JOIN match_participants mp ON p.id = mp.player_id
            JOIN matches m ON mp.match_id = m.id
            GROUP BY p.id, p.name
            ORDER BY (wins / total_games) DESC, wins DESC
        """
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query)
        stats = cursor.fetchall()
        return jsonify(stats)
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
