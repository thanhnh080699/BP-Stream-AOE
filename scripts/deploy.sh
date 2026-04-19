#!/usr/bin/expect -f
set timeout 180
spawn ssh -o StrictHostKeyChecking=no ubuntu@192.168.9.233
expect {
    "*assword*" {
        send "Bpt@052010\r"
    }
}
expect "$ "
send "find /home /opt /root -maxdepth 3 -name 'docker-compose.yml' 2>/dev/null\r"
expect "$ "
send "exit\r"
expect eof
