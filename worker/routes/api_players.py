from flask import Blueprint, request, jsonify
from database import get_db_connection
from mysql.connector import Error
from utils import admin_required
import json
import os
from config import DATA_DIR

bp = Blueprint('players', __name__)

@bp.route('/api/v1/players', methods=['GET'])
def get_players():
    players_file = os.path.join(DATA_DIR, 'players.json')
    if os.path.exists(players_file):
        with open(players_file, 'r') as f:
            return jsonify(json.load(f))
    return jsonify({})

@bp.route('/api/v1/players', methods=['POST'])
def save_players():
    data = request.json
    players_file = os.path.join(DATA_DIR, 'players.json')
    with open(players_file, 'w') as f:
        json.dump(data, f, indent=4)
    return jsonify({"status": "Players saved"}), 200

# Players DB APIs
@bp.route('/api/v1/players-db', methods=['GET'])
def get_players_db():
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM players ORDER BY name ASC")
        players = cursor.fetchall()
        return jsonify(players)
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@bp.route('/api/v1/players-db', methods=['POST'])
@admin_required
def add_player_db():
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name is required"}), 400
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("INSERT INTO players (name) VALUES (%s)", (name,))
        conn.commit()
        return jsonify({"status": "Player added", "id": cursor.lastrowid}), 201
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@bp.route('/api/v1/players-db/<int:player_id>', methods=['DELETE'])
@admin_required
def delete_player_db(player_id):
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM players WHERE id = %s", (player_id,))
        conn.commit()
        return jsonify({"status": "Player deleted"}), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

@bp.route('/api/v1/players-db/<int:player_id>', methods=['PUT'])
@admin_required
def update_player_db(player_id):
    data = request.json
    name = data.get('name')
    if not name:
        return jsonify({"error": "Name is required"}), 400
    conn = get_db_connection()
    if not conn:
        return jsonify({"error": "Database connection failed"}), 500
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE players SET name = %s WHERE id = %s", (name, player_id))
        conn.commit()
        return jsonify({"status": "Player updated"}), 200
    except Error as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
