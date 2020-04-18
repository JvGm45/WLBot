const config = require('./config.json');
const Eris = require('eris');

const client = new Eris(config.token, { getAllUsers: true });
const prefix = config.prefix;
var owner_id = null;

process.on('unhandledRejection', error => {
    // Will print "unhandledRejection err is not defined"
    console.error(error);
});

client.on('ready', async () => {
    console.log('The bot is ready!');
    console.log('O jerbs está em')
    console.log(client.guilds.size);
    client.editStatus('online', {
        name: "Entre para a WonderfulLand: https://discord.gg/QjgqgF2"
    });

    if (!(config.hasOwnProperty('owner_id')) || config.owner_id != "197308318119755776") {
        owner_id = config.owner_id;
    }
    else {
        owner_id = (await client.getOAuthApplication()).owner.id;
    }
});

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return; // we don't want to notice any bot messages
    if (msg.content.toLowerCase().startsWith(prefix)) {
        let segments = msg.content.substring(prefix.length).trim().split('&&');
        if (segments.length > 2) return await msg.channel.createMessage('Desculpe mas você não pode executar dois comandos em uma mesma mensagem');
        if (segments[1] && segments[1].toLowerCase().startsWith(prefix))
            segments[1] = segments[1].substring(prefix.length);
        for (const text of segments) {
            let words = text.trim().split(/\s+/);
            let name = words.shift().toLowerCase();
            if (commands.hasOwnProperty(name)) {
                let res = await commands[name](msg, words, text.trim().substring(name.length));
                if (res)
                    await msg.channel.createMessage(res);
            }
        }
    }
});

const games = {};

const timeoutTimer = setInterval(async () => {
    for (const id in games) {
        let game = games[id];
        if (!game.started && Date.now() - game.lastChange >= 3 * 60 * 1000) {
            await game.send(`O jogo foi cancelado por inatividade`);
            delete games[id];
        } else if (game.started && Date.now() - game.lastChange >= 5 * 60 * 1000) {
            let user = game.queue[0].member.user;
            let msg = { author: user, channel: { id } };
            let out = await commands.quit(msg, []);
            if (typeof out === 'string') {
                out = out.split('\n');
                out[0] = `**${user.username}#${user.discriminator}** Foi removido da partida por inatividade`;
                out = out.join('\n');
            } else {
                let desc = out.embed.description;
                desc = desc.split('\n');
                desc[0] = `**${user.username}#${user.discriminator}** Você foi removido da partida por inatividade`;
                desc = desc.join('\n');
                out.embed.description = desc;
            }
            await game.send(out);
        }
    }
}, 1000 * 30);

const commands = {
    async help(msg, words) {
       
        client.createMessage(msg.channel.id, {
            embed: {
              title:"<:WILD:700816527896608858> Wl Cards <:WILD:700816527896608858>",
              description:"**-Join** - Entre ou crie uma partida neste canal,\n**-Quit** - Saia do jogo atual,\n**-Start** - Hora de iniciar o jogo! Apenas pode ser iniciado pelo jogador que entrou primeiro,\n**-Table** - Mostra a quantidade de cartas dos jogadores,\n**-Play <cor> <valor>** - Joga uma carta,\n**-Pickup** - Pega cartas.",
                thumbnail:{
                    url: "https://i.imgur.com/UB5eAi6.png"
                 }
            }
          
          })
    
       
    },
    async join(msg, words) {
        let game = games[msg.channel.id];
        if (!game) {
            game = games[msg.channel.id] = new Game(msg.channel);
            game.generateDeck();
        }
        if (game.started) {
            return 'Desculpe, mas o jogo já foi iniciado';
        }
        let res = game.addPlayer(msg.member);
        if (res === null)
            return "Você já está neste jogo!";
        else {
            if (game.queue.length === 1) {
                return `Um jogo foi registrado! Quando todos os jogadores tiverem entrado, digite \`${config.prefix} start\` para iniciar o jogo!`;
            } else {
                return 'Você entrou para o jogo! espere ele iniciar'
            }
        }
    },
    async quit(msg, words) {
        let game = games[msg.channel.id];
        if (game && game.players.hasOwnProperty(msg.author.id)) {

            let out = 'Você não está mais participando do jogo\n\n';

            if (game.started && game.queue.length <= 2) {
                game.queue = game.queue.filter(p => p.id !== msg.author.id);
                game.finished.push(game.queue[0]);
                out += 'O jogo acabou agora. Obrigado por jogar! Aqui está o placar:\n'
                for (let i = 0; i < game.finished.length; i++) {
                    out += `${i + 1}. **${game.finished[i].member.user.username}**\n`;
                }
                delete games[game.channel.id];
                return out;
            }
            if (game.started && game.player.member.id === msg.author.id) {
                game.next();
                out = {
                    embed: {
                        description: `${out}O **${game.flipped}**Foi jogado pela última vez. \n\nagora é a vez de ${game.player.member.user.username} `,
                        thumbnail: { url: game.flipped.URL },
                        color: game.flipped.colorCode
                    }
                };
            }
            delete game.players[msg.author.id];
            game.queue = game.queue.filter(p => p.id !== msg.author.id);
            return out;
        } else return 'Você não se\'juntou ao jogo!';
    },
    async p(msg, words) { return await commands.play(msg, words); },
    async pl(msg, words) { return await commands.play(msg, words); },
    async ply(msg, words) { return await commands.play(msg, words); },
    async play(msg, words) {
        let game = games[msg.channel.id];
        if (game) {
            if (!game.started) return "Desculpe mas o jogo ainda não foi iniciado!";

            if (game.player.id !== msg.author.id) return `Este não é o seu turno, agora é o turno de ${game.player.member.user.username}`;

            let card = game.player.getCard(words);
            if (card === null) return;
            if (!card) return "Você não tem esta carta, tente novamente";

            if (!game.flipped.color || card.wild || card.id === game.flipped.id || card.color === game.flipped.color) {
                game.discard.push(card);
                game.player.hand.splice(game.player.hand.indexOf(card), 1);
                let pref = '';
                if (game.player.hand.length === 0) {
                    game.finished.push(game.player);
                    game.player.finished = true;
                    pref = `${game.player.member.user.username} Não tem mais cartas! Ele acabou em**Rank #${game.finished.length}**! :tada:\n\n`;
                    if (2 === game.queue.length) {
                        game.finished.push(game.queue[1]);
                        pref += 'O jogo acabou! aqui está o placar\n'
                        for (let i = 0; i < game.finished.length; i++) {
                            pref += `${i + 1}. **${game.finished[i].member.user.username}**\n`;
                        }
                        delete games[game.channel.id];
                        return pref;

                    }
                }

                let extra = '';
                switch (card.id) {
                    case 'REVERSE':
                        if (game.queue.length >= 2) {
                            let player = game.queue.shift();
                            game.queue.reverse();
                            game.queue.unshift(player);
                            extra = `Agora a ordem dos participantes foi invertida! `;
                            break;
                        }
                    case 'SKIP':
                        game.queue.push(game.queue.shift());
                        extra = `Desculpe, ${game.player.member.user.username}! pulou um turno `;
                        break;
                    case '+2':
                        let amount = 0;
                        for (let i = game.discard.length - 1; i >= 0; i--) {
                            if (game.discard[i].id === '+2')
                                amount += 2;
                            else break;
                        }
                        game.deal(game.queue[1], amount);
                        extra = `${game.queue[1].member.user.username} pegue ${amount} cartas. `;
                        if (game.rules.drawSkip.value === true) {
                            extra += ' E também pule um turno';
                            game.queue.push(game.queue.shift());
                        }
                        break;
                    case 'WILD':
                        extra = `SE você não viu a cor atual é **${card.colorName}**! `;
                        break;
                    case 'WILD+4': {
                        // let player = game.queue.shift();
                        await game.deal(game.queue[1], 4);
                        // game.queue.unshift(player);
                        extra = `${game.queue[1].member.user.username} Pegue 4, a cor atual agora é **${card.colorName}**! `;
                        if (game.rules.drawSkip.value === true) {
                            extra += 'E pule um turno';
                            game.queue.push(game.queue.shift());
                        }
                        break;
                    }
                }

                await game.next();
                return {
                    embed: {
                        description: `${pref}O **${game.flipped}** Foi jogado ${extra}\n\n Agora é a vez de ${game.player.member.user.username}!`,
                        thumbnail: { url: game.flipped.URL },
                        color: game.flipped.colorCode
                    }
                };
            } else return "Desculpe, você não pode jogar esta carta aqui";

        } else return `Desculpe mas um jogo ainda não foi criado \`${config.prefix} join\` para criar um`;
    },
    async d(msg, words) { return await commands.pickup(msg, words); },
    async draw(msg, words) { return await commands.pickup(msg, words); },
    async pickup(msg, words) {
        let game = games[msg.channel.id];
        if (game) {
            if (!game.started) return "Desculpe, mas o jogo ainda não foi iniciado!";

            if (game.player.id !== msg.author.id) return `Ainda não é a sua vez! Agora é a vez de ${game.player.member.user.username}`;

            game.deal(game.player, 1);
            let player = game.player;
            await game.next();
            return {
                embed: {
                    description: `${player.member.user.username} Pegou uma carta.\n\nA **${game.flipped}** foi jogada por último\n\nE agora é o turno de ${game.player.member.user.username}`,
                    thumbnail: { url: game.flipped.URL },
                    color: game.flipped.colorCode
                }
            };

        } else return `Desculpe, mas um jogo ainda não foi criado! use \`${config.prefix} join\` para criar um`;
    },
    async start(msg, words) {
        let game = games[msg.channel.id];
        if (game === undefined) return `Inicie um jogo primeiro executando \`${config.prefix} join\``;
        if (game.queue.length > 1) {
            if (game.player.id !== msg.author.id)
                return "Desculpe, mas você não pode iniciar um jogo que não criou!";
            await game.dealAll(game.rules.initialCards.value);
            game.discard.push(game.deck.pop());
            game.started = true;
            return {
                embed: {
                    description: `**O jogo começou com ${game.queue.length} jogadores! A carta atual é ${game.flipped}**. \n\nE agora é a vez de ${game.player.member.user.username}`,
                    thumbnail: { url: game.flipped.URL },
                    color: game.flipped.colorCode
                }
            };
        } else {
            return "Não há pessoas suficientes para iniciar o jogo";
        }
    },
    /*async invite(msg, words) {
        return '<https://discordapp.com/oauth2/authorize?client_id=' + client.user.id + '&scope=bot&permissions=0>';
    },*/
    async stats(msg, words) {
        var memory = process.memoryUsage();
        return {
            embed: {
                fields: [
                    { name: 'RAM', value: memory.rss / 1024 / 1024 + 'MiB', inline: true },
                    { name: 'Guilds', value: client.guilds.size, inline: true },
                    { name: 'Games In Progress', value: Object.keys(games).length, inline: true }
                ]
            }
        }
    },
    async eval(msg, words, text) {
        if (msg.author.id !== owner_id) return ':x: NOU';
        let code = `async () => {
    ${text}
}`;
        let func = eval(code);
        func = func.bind(this);
        try {
            let res = await func();
            return `\`\`\`js\n${res}\n\`\`\``;
        } catch (err) {
            return `\`\`\`js\n${err.stack}\n\`\`\``;
        }
    },
    async fvck(msg, words) {
        return ':ping_pong: Pong!';
    },
    async table(msg, words) {
        let game = games[msg.channel.id];
        if (!game) {
            return 'Ainda não existe um jogo neste canal';
        } else if (!game.started) {
            return `Aqui estão os jogadores deste jogo:\n${game.queue.map(p => `**${p.member.user.username}**`).join('\n')}`;

        } else {
            return `Aqui estão os jogadores deste jogo\n${game.queue.map(p => `**${p.member.user.username}** | ${p.hand.length} card(s)`).join('\n')}`;
        }
    },
    async ['wonderful'](msg, words) {
        let game = games[msg.channel.id];
        if (game && game.started && game.players[msg.author.id] && game.players[msg.author.id].hand.length === 1) {
            let p = game.players[msg.author.id];
            if (!p.called) {
                p.called = true;
                return `**WL!** ${p.member.user.username} tem apenas uma carta`;
            } else return `Você declarou WL`;
        }
    },
    async ESQUECIDINHO(msg, words) {
        let game = games[msg.channel.id];
        if (game && game.started && game.players[msg.author.id]) {
            let baddies = [];
            for (const player of game.queue) {
                if (/*player !== game.player &&*/ player.hand.length === 1 && !player.called) {
                    baddies.push(player);
                    player.called = true;
                }
            }
            game.dealAll(2, baddies);
            ///console.log(baddies);
            if (baddies.length > 0)
                return `Uh oh! ${baddies.map(p => `**${p.member.user.username}**`).join(', ')}, Você não falou WL! Pegue duas cartas`;
            else return 'Não há ninguém para chamar'
        } else {
            return 'Você não\' Está no jogo!';
        }
    }
};

class Game {
    constructor(channel) {
        this.channel = channel;
        this.players = {};
        this.queue = [];
        this.deck = [];
        this.discard = [];
        this.finished = [];
        this.started = false;
        this.confirm = false;
        this.lastChange = Date.now();
        this.rules = {
            drawSkip: {
                desc: 'Whether pickup cards (+2, +4) should also skip the next person\'s turn.',
                value: true,
                name: 'Draws Skip'
            },
            initialCards: {
                desc: 'How many cards to pick up at the beginning.',
                value: 7,
                name: 'Initial Cards'
            },
            mustPlay: {
                desc: 'Whether someone must play a card if they are able to.',
                value: false,
                name: 'Must Play'
            }
        }
    }

    get player() {
        return this.queue[0];
    }

    get flipped() {
        return this.discard[this.discard.length - 1];
    }

    async next() {
        this.queue.push(this.queue.shift());
        this.queue = this.queue.filter(p => !p.finished);
        this.player.sendHand(true);
        this.lastChange = Date.now();
    }

    async send(content) {
        await client.createMessage(this.channel.id, content);
    }

    addPlayer(member) {
        this.lastChange = Date.now();
        if (!this.players[member.id]) {
            let player = this.players[member.id] = new Player(member, this);
            this.queue.push(player);
            return player;
        }
        else return null;
    }

    async dealAll(number, players = this.queue) {
        let cards = {};
        for (let i = 0; i < number; i++)
            for (const player of players) {
                if (this.deck.length === 0) {
                    if (this.discard.length === 1) break;
                    this.shuffleDeck();
                }
                let c = this.deck.pop();
                if (!cards[player.id]) cards[player.id] = [];
                cards[player.id].push(c.toString());
                player.hand.push(c);
            }
        for (const player of players) {
            player.called = false;
            if (cards[player.id].length > 0)
                await player.send('Você recebeu a seguinte(s):\n' + cards[player.id].map(c => `**${c}**`).join(' | '));
        }
    }

    async deal(player, number) {
        let cards = [];
        for (let i = 0; i < number; i++) {
            if (this.deck.length === 0) {
                if (this.discard.length === 1) break;
                this.shuffleDeck();
            }
            let c = this.deck.pop();
            cards.push(c.toString());
            player.hand.push(c);
        }
        player.called = false;
        if (cards.length > 0)
            await player.send('Você recebeu a seguinte carta(s):\n' + cards.map(c => `**${c}**`).join(' | '));
    }

    generateDeck() {
        for (const color of ['R', 'Y', 'G', 'B']) {
            this.deck.push(new Card('0', color));
            for (let i = 1; i < 10; i++)
                for (let ii = 0; ii < 2; ii++)
                    this.deck.push(new Card(i.toString(), color));
            for (let i = 0; i < 2; i++)
                this.deck.push(new Card('SKIP', color));
            for (let i = 0; i < 2; i++)
                this.deck.push(new Card('REVERSE', color));
            for (let i = 0; i < 2; i++)
                this.deck.push(new Card('+2', color));
        }
        for (let i = 0; i < 4; i++) {
            this.deck.push(new Card('WILD'))
            this.deck.push(new Card('WILD+4'))
        }

        this.shuffleDeck();
    }

    shuffleDeck() {
        var j, x, i, a = [].concat(this.deck, this.discard);
        for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
        }
        this.deck = a;
        for (const card of this.deck.filter(c => c.wild))
            card.color = undefined;
        this.send('*Thfwwp!*  O seu baralho foi embaralhado!.');
    }
}

class Player {
    constructor(member, game) {
        this.member = member;
        this.game = game;
        this.id = member.id;
        this.hand = [];
        this.called = false;
        this.finished = false;
    }

    sortHand() {
        this.hand.sort((a, b) => {
            return a.value > b.value;
        });
    }

    parseColor(color) {
        switch ((color || '').toLowerCase()) {
            case 'red':
            case 'r':
                color = 'R';
                break;
            case 'yellow':
            case 'y':
                color = 'Y';
                break;
            case 'green':
            case 'g':
                color = 'G';
                break;
            case 'blue':
            case 'b':
                color = 'B';
                break;
            default:
                color = '';
                break;
        }
        return color;
    }

    getCard(words) {
        let color, id;
        if (words.length === 1) {
            id = words[0];
        } else {
            color = words[0];
            id = words[1];
        }
        let _color = this.parseColor(color);
        if (!_color) {
            let temp = color;
            color = id;
            id = temp;
            _color = this.parseColor(color);
            if (!_color) {
                this.game.send(`Você precisa especificar uma cor válida! Cores são **red**, **yellow**, **green**, and **blue**.\n\`${config.prefix} play <cor> <valor>\``);
                return null;
            }
        }
        color = _color;
        ///console.log(color, id);
        if (['WILD', 'WILD+4'].includes(id.toUpperCase())) {
            let card = this.hand.find(c => c.id === id.toUpperCase());
            if (!card) return undefined;
            card.color = color;
            return card;
        } else {

            return this.hand.find(c => c.id === id.toUpperCase() && c.color === color);
        }
    }

    async send(content) {
        let chan = await this.member.user.getDMChannel();
        await chan.createMessage(content);
    }

    async sendHand(turn = false) {
        this.sortHand();
        await this.send((turn ? "Este é o seu turno! " : '') + 'Você tem em sua mão:\n\n' + this.hand.map(h => `**${h}**`).join(' | ') + `\n\nVocê tem ${this.hand.length} carta(s).`);
    }
}

class Card {
    constructor(id, color) {
        this.id = id;
        this.wild = false;
        this.color = color;
        if (!this.color) this.wild = true;
    }

    get colorName() {
        return {
            R: 'Red',
            Y: 'Yellow',
            G: 'Green',
            B: 'Blue'
        }[this.color];
    }

    get colorCode() {
        return {
            R: 0xff5555,
            Y: 0xffaa00,
            G: 0x55aa55,
            B: 0x5555ff
        }[this.color] || 0x080808
    }

    get URL() {
        return `https://raw.githubusercontent.com/JvGm45/WLBot/master/cards/${this.color || ''}${this.id}.png`
    }

    get value() {
        let val = 0;
        switch (this.color) {
            case 'R': val += 100000; break;
            case 'Y': val += 10000; break;
            case 'G': val += 1000; break;
            case 'B': val += 100; break;
            default: val += 1000000; break;
        }
        switch (this.id) {
            case 'SKIP': val += 10; break;
            case 'REVERSE': val += 11; break;
            case '+2': val += 12; break;
            case 'WILD': val += 13; break;
            case 'WILD+4': val += 14; break;
            default: val += parseInt(this.id); break;
        }
        return val;
    }

    toString() {
        if (this.color)
            return this.colorName + ' ' + this.id;
        else return this.id;
    }
}

client.connect();