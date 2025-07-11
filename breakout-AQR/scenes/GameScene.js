/**
 * GameScene - Escena principal del juego
 * Contiene toda la lógica del juego Breakout
 */
class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.paddle = null;
        this.ball = null;
        this.bricks = null;
        this.powerUps = null;
        this.scoreText = null;
        this.livesText = null;
        this.levelText = null;
        this.cursors = null;
        this.gameStarted = false;
        this.ballSpeed = 300;
        this.paddleSpeed = 400;
    }

    preload() {
        this.load.image('bg_futurista', 'assets/images/fondo1.png');
    }

    create() {
        // Configurar física
        this.physics.world.setBounds(0, 0, 800, 600);
        
        // Mejorar precisión de colisiones
        this.physics.world.setFPS(60);
        
        // Crear elementos del juego
        this.createPaddle();
        this.createBall();
        this.createBricks();
        this.createUI();
        this.createPowerUps();
        
        // Configurar controles
        this.setupControls();
        
        // Configurar colisiones
        this.setupCollisions();
        
        // Inicializar estado del juego
        this.resetGame();

        // Fondo atenuado
        this.bgImage = this.add.image(400, 300, 'bg_futurista').setDisplaySize(800, 600);
        this.bgImage.setAlpha(0.25); // Atenuado
        this.bgImage.setDepth(-10); // Asegura que esté detrás de todo
    }

    createPaddle() {
        this.paddle = this.physics.add.sprite(400, 550, 'gameAtlas', 'paddle');
        this.paddle.setCollideWorldBounds(true);
        this.paddle.setImmovable(true);
    }

    createBall() {
        this.ball = this.physics.add.sprite(400, 530, 'gameAtlas', 'ball');
        this.ball.setBounce(1, 1);
        // Permite colisión en paredes izquierda, derecha y techo; quita colisión en el fondo
        this.ball.setCollideWorldBounds(true, true, true, false);
        
        // Desactivar colisión abajo (solo fondo)
        this.ball.body.checkCollision.down = false;

        // Habilitar evento al salirse por abajo
        this.ball.body.onWorldBounds = true;
        this.physics.world.on('worldbounds', (body, up, down) => {
            // Solo cuando la bola cruce el fondo
            if (body.gameObject === this.ball && down) {
                this.loseLife();    // función que decrementa vidas
                this.resetBall();   // función que reposiciona la bola
            }
        }, this);
        
        this.ball.setData('speed', this.ballSpeed);
        
        // Posicionar la bola encima del paddle inicialmente
        this.resetBall();
    }

    createBricks() {
        this.bricks = this.physics.add.staticGroup();
        this.generateBricks();
    }

    generateBricks() {
        const brickColors = [0x547AA5, 0xBA68C8, 0x4DD0E1, 0xFFB74D];
        const rows = 5;
        const cols = 10;
        const brickWidth = 64;
        const brickHeight = 16;
        const padding = 4;
        const offsetTop = 80;
        const offsetLeft = 80;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = offsetLeft + col * (brickWidth + padding);
                const y = offsetTop + row * (brickHeight + padding);
                
                const brick = this.bricks.create(x, y, 'gameAtlas', 'brick');
                brick.setTint(brickColors[row % brickColors.length]);
                brick.setData('row', row);
                brick.setData('col', col);
                
                // Algunos ladrillos pueden contener power-ups
                if (Math.random() < 0.1) {
                    brick.setData('hasPowerUp', true);
                    brick.setData('powerUpType', this.getRandomPowerUpType());
                }
            }
        }
    }

    getRandomPowerUpType() {
        const types = ['enlarge', 'laser', 'zoom', 'multi'];
        return types[Math.floor(Math.random() * types.length)];
    }

    createPowerUps() {
        this.powerUps = this.physics.add.group();
    }

    createUI() {
        const style = {
            fontSize: '16px',
            fontFamily: 'Arial',
            fill: '#F4F4F9'
        };

        this.scoreText = this.add.text(16, 16, 'Puntuación: 0', style);
        this.livesText = this.add.text(16, 40, 'Vidas: 3', style);
        this.levelText = this.add.text(16, 64, 'Nivel: 1', style);

        // Texto de instrucciones
        this.instructionText = this.add.text(400, 300, 'Presiona ESPACIO1 para lanzar la bola', {
            fontSize: '18px',
            fontFamily: 'Arial',
            fill: '#FFD93D',
            align: 'center'
        });
        this.instructionText.setOrigin(0.5);
    }

    setupControls() {
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Controles de teclado
        this.input.keyboard.on('keydown-SPACE', () => {
            if (!this.gameStarted) {
                this.startGame();
            }
        });

        // Control por mouse/touch para mover el paddle
        this.input.on('pointermove', (pointer) => {
            if (this.paddle && this.gameStarted) {
                this.paddle.x = Phaser.Math.Clamp(pointer.x, 32, 768);
            }
        });

        // Control por touch para iniciar el juego
        this.input.on('pointerdown', (pointer) => {
            if (!this.gameStarted) {
                this.startGame();
            }
        });
    }

    setupCollisions() {
        // Colisión bola con paleta
        this.physics.add.collider(this.ball, this.paddle, this.ballHitPaddle, null, this);
        
        // Colisión bola con ladrillos
        this.physics.add.collider(this.ball, this.bricks, this.ballHitBrick, null, this);
        
        // Colisión power-ups con paleta
        this.physics.add.overlap(this.paddle, this.powerUps, this.collectPowerUp, null, this);
    }

    ballHitPaddle(ball, paddle) {
        // Verificar que la bola esté realmente colisionando con el paddle
        if (!ball.body || !paddle.body) return;
        
        // Calcular la posición correcta de la bola
        const paddleTop = paddle.y - paddle.height/2;
        const ballBottom = ball.y + ball.height/2;
        
        // Si la bola está por debajo del paddle, corregir su posición
        if (ballBottom > paddleTop) {
            ball.y = paddleTop - ball.height/2;
        }
        
        // Calcular ángulo de rebote basado en dónde golpeó la bola
        const hitPoint = (ball.x - paddle.x) / (paddle.width / 2);
        const angle = hitPoint * Math.PI / 3; // -60° a +60°
        
        const velocity = ball.getData('speed');
        
        // Asegurar velocidad mínima hacia arriba
        let newVelocityY = -velocity * Math.cos(angle);
        if (newVelocityY > -100) {
            newVelocityY = -100; // Velocidad mínima hacia arriba
        }
        
        ball.setVelocity(
            velocity * Math.sin(angle),
            newVelocityY
        );
        
        // Reproducir sonido
        this.sound.play('paddle_hit');
    }

    ballHitBrick(ball, brick) {
        // Destruir el ladrillo
        brick.destroy();
        
        // Reproducir sonido
        this.sound.play('brick_hit');
        
        // Actualizar puntuación
        window.gameState.score += 10;
        this.scoreText.setText('Puntuación: ' + window.gameState.score);
        
        // Verificar si el ladrillo tenía power-up
        if (brick.getData('hasPowerUp')) {
            this.createPowerUp(brick.x, brick.y, brick.getData('powerUpType'));
        }
        
        // Verificar si se completó el nivel
        if (this.bricks.countActive() === 0) {
            this.levelComplete();
        }
    }

    createPowerUp(x, y, type) {
        const powerUp = this.physics.add.sprite(x, y, 'gameAtlas', `powerup_${type}`);
        powerUp.setData('type', type);
        powerUp.setVelocityY(100);
        this.powerUps.add(powerUp);
    }

    collectPowerUp(paddle, powerUp) {
        // Reproducir sonido
        this.sound.play('powerup_collect');
        
        // Aplicar efecto del power-up
        this.applyPowerUp(powerUp.getData('type'));
        
        // Destruir power-up
        powerUp.destroy();
    }

    applyPowerUp(type) {
        switch (type) {
            case 'enlarge':
                this.paddle.setScale(1.5, 1);
                this.time.delayedCall(10000, () => {
                    this.paddle.setScale(1, 1);
                });
                break;
            case 'laser':
                // Implementar disparos láser
                this.enableLaserMode();
                break;
            case 'zoom':
                // Implementar zoom de cámara
                this.cameras.main.zoomTo(1.2, 1000);
                this.time.delayedCall(5000, () => {
                    this.cameras.main.zoomTo(1, 1000);
                });
                break;
            case 'multi':
                this.createMultipleBalls();
                break;
        }
    }

    enableLaserMode() {
        // Implementación básica de modo láser
        console.log('Modo láser activado');
    }

    createMultipleBalls() {
        // Crear bolas adicionales
        for (let i = 0; i < 2; i++) {
            const newBall = this.physics.add.sprite(this.ball.x, this.ball.y, 'gameAtlas', 'ball');
            newBall.setBounce(1, 1);
            // Configurar colisiones mundiales igual que la bola principal
            newBall.setCollideWorldBounds(true, true, true, false);
            newBall.body.checkCollision.down = false;
            newBall.body.onWorldBounds = true;
            
            newBall.setVelocity(
                this.ball.body.velocity.x + (Math.random() - 0.5) * 100,
                this.ball.body.velocity.y + (Math.random() - 0.5) * 100
            );
            
            // Configurar colisiones para la nueva bola
            this.physics.add.collider(newBall, this.paddle, this.ballHitPaddle, null, this);
            this.physics.add.collider(newBall, this.bricks, this.ballHitBrick, null, this);
        }
    }

    startGame() {
        if (!this.gameStarted) {
            this.gameStarted = true;
            if (this.instructionText) {
                this.instructionText.destroy();
                this.instructionText = null;
            }
            
            // Lanzar la bola
            const angle = Phaser.Math.Between(-45, 45);
            const velocity = this.ball.getData('speed');
            this.ball.setVelocity(
                velocity * Math.sin(Phaser.Math.DegToRad(angle)),
                -velocity * Math.cos(Phaser.Math.DegToRad(angle))
            );
        }
    }

    levelComplete() {
        // Reproducir sonido
        this.sound.play('level_complete');
        
        // Incrementar nivel
        window.gameState.level++;
        this.levelText.setText('Nivel: ' + window.gameState.level);
        
        // Aumentar velocidad
        this.ballSpeed += 50;
        this.ball.setData('speed', this.ballSpeed);
        
        // Generar nuevo nivel
        this.time.delayedCall(1000, () => {
            this.generateBricks();
            this.resetBall();
            
            // Mostrar instrucciones para el nuevo nivel
            if (this.instructionText) {
                this.instructionText.destroy();
                this.instructionText = null;
            }
            this.instructionText = this.add.text(400, 350, 'Presiona ESPACIO2 para lanzar la bola', {
                fontSize: '18px',
                fontFamily: 'Arial',
                fill: '#FFD93D',
                align: 'center'
            });
            this.instructionText.setOrigin(0.5);
        });
    }

    resetBall() {
        // Posicionar la bola encima del paddle
        this.ball.setPosition(this.paddle.x, this.paddle.y - this.paddle.height/2 - this.ball.height/2);
        this.ball.setVelocity(0, 0);
        this.gameStarted = false;
        
        // Mostrar instrucciones nuevamente
        if (this.instructionText) {
            this.instructionText.destroy();
            this.instructionText = null;
        }
        /*this.instructionText = this.add.text(400, 400, 'Presiona ESPACIO3 para lanzar la bola', {
            fontSize: '18px',
            fontFamily: 'Arial',
            fill: '#FFD93D',
            align: 'center'
        });
        this.instructionText.setOrigin(0.5);*/
    }

    resetGame() {
        window.gameState.score = 0;
        window.gameState.lives = 3;
        window.gameState.level = 1;
        this.ballSpeed = 300;
        
        this.scoreText.setText('Puntuación: 0');
        this.livesText.setText('Vidas: 3');
        this.levelText.setText('Nivel: 1');
        
        this.resetBall();
        
        // Mostrar instrucciones al inicio del juego
        if (this.instructionText) {
            this.instructionText.destroy();
            this.instructionText = null;
        }
        /*this.instructionText = this.add.text(400, 450, 'Presiona ESPACIO4 para lanzar la bola', {
            fontSize: '18px',
            fontFamily: 'Arial',
            fill: '#FFD93D',
            align: 'center'
        });
        this.instructionText.setOrigin(0.5);*/
    }

    update() {
        // Control de la paleta con teclado (solo cuando el juego ha comenzado)
        if (this.gameStarted) {
            if (this.cursors.left.isDown) {
                this.paddle.setVelocityX(-this.paddleSpeed);
            } else if (this.cursors.right.isDown) {
                this.paddle.setVelocityX(this.paddleSpeed);
            } else {
                this.paddle.setVelocityX(0);
            }
        } else {
            // Si el juego no ha comenzado, mantener la bola encima del paddle
            this.paddle.setVelocityX(0);
            if (this.ball && this.paddle) {
                this.ball.setPosition(this.paddle.x, this.paddle.y - this.paddle.height/2 - this.ball.height/2);
            }
        }
        
        // Verificación adicional para evitar que la bola atraviese el paddle
        if (this.ball && this.paddle && this.ball.body && this.paddle.body) {
            const paddleTop = this.paddle.y - this.paddle.height/2;
            const ballBottom = this.ball.y + this.ball.height/2;
            
            // Si la bola está por debajo del paddle y moviéndose hacia abajo
            if (ballBottom > paddleTop && this.ball.body.velocity.y > 0) {
                // Verificar si está dentro del rango horizontal del paddle
                const paddleLeft = this.paddle.x - this.paddle.width/2;
                const paddleRight = this.paddle.x + this.paddle.width/2;
                
                if (this.ball.x >= paddleLeft && this.ball.x <= paddleRight) {
                    // Corregir posición y forzar rebote
                    this.ball.y = paddleTop - this.ball.height/2;
                    this.ball.setVelocityY(-Math.abs(this.ball.body.velocity.y));
                }
            }
        }
    }

    loseLife() {
        window.gameState.lives--;
        this.livesText.setText('Vidas: ' + window.gameState.lives);
        
        if (window.gameState.lives <= 0) {
            this.gameOver();
        } else {
            this.resetBall();
            
            // Mostrar instrucciones para la nueva vida
            if (this.instructionText) {
                this.instructionText.destroy();
                this.instructionText = null;
            }
            this.instructionText = this.add.text(400, 500, 'Presiona ESPACIO5 para lanzar la bola', {
                fontSize: '18px',
                fontFamily: 'Arial',
                fill: '#FFD93D',
                align: 'center'
            });
            this.instructionText.setOrigin(0.5);
        }
    }

    gameOver() {
        // Reproducir sonido
        this.sound.play('game_over');
        
        // Guardar puntuación más alta
        if (window.gameState.score > window.gameState.highScore) {
            window.gameState.highScore = window.gameState.score;
            localStorage.setItem('breakoutHighScore', window.gameState.highScore);
        }
        
        // Ir a escena de game over
        this.scene.start('GameOverScene');
    }
}

// Hacer la clase disponible globalmente
window.GameScene = GameScene; 