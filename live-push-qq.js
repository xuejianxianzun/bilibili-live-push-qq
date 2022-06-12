// 监控 bilibili 直播间，当主播开播或下播时，通过 QQ 机器人（go-cqhttp）发送 QQ 消息进行提醒
// 默认只在开播时发送提醒
// github: https://github.com/xuejianxianzun/bilibili-live-push-qq
const https = require('https')
const http = require('http')

// 以直播间为单位进行配置
// 消息里可以使用的转义代码：
// {name} {title} {room_id}
const room_list = [
  {
    room_id: 23251345,  // 直播间 id
    name: '千零莉露卡', // 主播名字或昵称
    status: 0,  // 直播状态，不需要用户修改
    cover: '',  // 封面图，不需要用户修改
    send_cover: true, // 是否发送直播间封面图片
    title: '', // 直播间标题，不需要用户修改
    interval: 60000,  // 多久查询一次直播状态（毫秒）。默认 1 分钟查询一次
    qq_group: 123456789, // 发送消息到哪个 QQ 群里。设置为 0 则不发送。（不会 @全体成员）
    // 如果需要更复杂的 qq 群消息设置，例如发送到多个群，或者（并且）需要 @全体成员，则可以把上面的 qq_group 设置为 0
    // 然后在下面的 qq_group_list 里设置群号和是否 @全体成员
    // qq_group_list 不使用时可以为空数组，也可以删除该属性
    qq_group_list: [
      {
        id: 1111111,
        at_all: true,
      },
      {
        id: 222222,
        at_all: false,
      },
    ],
    qq_person: 111111111, // 发送消息到哪个 QQ 号上（即私聊）。设置为 0 则不发送。如果需要发送，建议先加好友，不知道对陌生人能不能发送
    msg: [             // 当直播状态变化时要发送的提醒消息
      '{name}尚未开播', // 0 尚未开播的提醒消息
      '{name}正在直播：{title} https://live.bilibili.com/{room_id}', // 1 正在直播的提醒消息
      '{name}正在轮播'  // 2 轮播的提醒消息
    ],
  },
  {
    room_id: 510,
    name: '小孩梓',
    status: 0,
    cover: '',
    send_cover: true,
    title: '',
    interval: 60000,
    qq_group: 333333333,
    qq_group_list: [],
    qq_person: 0,
    msg: [
      '{name}尚未开播',
      '{name}正在直播：{title} https://live.bilibili.com/{room_id}',
      '{name}正在轮播'
    ],
  },
]

// 获取直播间数据
function getLiveRoomData (room_id) {
  // 这个 api 获取的数据很少
  // const url = `https://api.live.bilibili.com/room/v1/Room/room_init?id=${room_id}`

  // 这个 api 获取的数据多，因为现在要获取封面图，所以换成了这个 api
  const url = `https://api.live.bilibili.com/xlive/web-room/v1/index/getInfoByRoom?room_id=${room_id}`
  https.get(url, res => {
    let body = ''

    res.on('data', (chunk) => {
      body += chunk
    })

    res.on('end', () => {
      try {
        const json = JSON.parse(body)
        cb(room_id, json)
      } catch (error) {
        console.error(error.message)
      }
    })
  }).on('error', (e) => {
    console.log(room_id)
    console.error(e)
  })
}

function getRoomCfg (room_id) {
  const room = room_list.find(data => data.room_id === room_id)
  if (!room) {
    console.log(`没找到这个直播间的配置${room_id}`)
  }
  return room
}

// 解析直播间数据
function cb (room_id, json) {
  const room = getRoomCfg(room_id)
  if (!room) {
    return
  }

  const status = json.data.room_info.live_status
  // console.log(status)
  room.cover = json.data.room_info.cover
  room.title = json.data.room_info.title

  // 当直播状态变化时发送提示
  if (status !== room.status) {
    room.status = status
    switch (status) {
      case 0:
        // sendMsg(room_id)
        break
      case 1:
        sendMsg(room_id)
        break
      case 2:
        // sendMsg(room_id)
        break
      default:
        console.log(`不知道啥情况。status ${status}`)
    }
  }
}

// 发送提醒消息
function sendMsg (room_id) {
  // 获取提醒消息
  const room = getRoomCfg(room_id)
  if (!room) {
    return
  }
  let msg = room.msg[room.status]
  if (!msg) {
    return console.log(`没有找到提醒消息。${room_id} ${room.status}`)
  }

  // 替换转义代码
  msg = msg.replace('{name}', room.name)
    .replace('{title}', room.title)
    .replace('{room_id}', room.room_id)

  console.log(msg)

  // 生成封面图代码
  const imageCode = (room.send_cover && room.cover) ? `[CQ:image,file=${room.cover}]` : ''
  // CQ 码里时用 file 可以发送图片，但是 url 不行

  // 发送消息到指定群
  if (room.qq_group !== 0) {
    const url = `http://127.0.0.1:5700/send_group_msg?group_id=${room.qq_group}&message=${imageCode}${msg}&auto_escape=false`
    http.get(encodeURI(url))
  }

  // 发送消息到多个群或者 @全体成员
  if (room.qq_group_list && room.qq_group_list.length > 0) {
    let time = 0
    for (const group of room.qq_group_list) {
      if (group.id) {
        setTimeout(() => {
          const atCode = group.at_all ? '[CQ:at,qq=all,name=不在群的QQ]' : ''
          const url = `http://127.0.0.1:5700/send_group_msg?group_id=${group.id}&message=${imageCode}${atCode}${msg}&auto_escape=false`
          http.get(encodeURI(url))
        }, time)
        time += 1000
      }
    }
  }


  // 发送消息到个人
  if (room.qq_person !== 0) {
    const url = `http://127.0.0.1:5700/send_private_msg?user_id=${room.qq_person}&message=${imageCode}${msg}&auto_escape=false`
    http.get(encodeURI(url))
  }
}

// 启动
let time_start = 0
let add = 500 // 如果有多个直播间，则每次请求错开一段时间，避免拥挤

room_list.forEach(room_data => {
  setTimeout(() => {
    time_start += add

    // 启动时立即查询一次
    getLiveRoomData(room_data.room_id)

    // 然后定时查询
    setInterval(() => {
      getLiveRoomData(room_data.room_id)
    }, room_data.interval)
  }, time_start)
})
